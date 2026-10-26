from django.http import Http404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authorization_core.application.user_identity_service import UserIdentityService
from apps.resources.models import Article, Book
from apps.resources.serializers import list_article_ids

from ..application.resource_check_service import ResourceCheckService
from ..application.subject_factory import SubjectFactory
from ..application.unlock_service import UnlockService
from ..application.settlement_service import ResourceSettlementService
from ..domain.constants import CONDITION_TYPE_ENCRYPTED, CONDITION_TYPE_MONEY, STATUS_PURCHASE_REQUIRED
from .repositories import ResourceRepository
from .serializers import ResourceAccessQuerySerializer, ResourcePasswordSerializer, ResourcePurchaseSerializer


class BaseResourceAccessView(APIView):
    permission_classes = (permissions.AllowAny,)
    allowed_condition_types = None

    def get_resource(self, resource_type, resource_id):
        resource = ResourceRepository.get_resource(resource_type, resource_id)
        if resource is None:
            raise Http404
        return resource

    def book_context_for_resource(self, resource, resource_type, user, book_id):
        if resource_type != "article" or not isinstance(resource, Article):
            return None
        if not book_id:
            return False
        try:
            book = Book.objects.get(pk=book_id)
        except Book.DoesNotExist:
            return False
        if resource.pk not in list_article_ids(book.structure):
            return False
        return ResourceCheckService.build_access_check(
            book,
            user,
            resource_type="book",
        ).all_granted


class ResourceAccessCheckView(BaseResourceAccessView):
    def get(self, request, resource_type, resource_id):
        resource = self.get_resource(resource_type, resource_id)
        serializer = ResourceAccessQuerySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        book_context = self.book_context_for_resource(resource, resource_type, request.user, serializer.validated_data.get("bookId"))
        if book_context is None:
            book_context = serializer.validated_data["book_context"]
        decision = ResourceCheckService.build_access_check(resource, request.user, book_context=book_context, resource_type=resource_type, allowed_condition_types=self.allowed_condition_types)
        return Response(decision.to_dict(), status=status.HTTP_200_OK)


class ResourceAccessPasswordView(BaseResourceAccessView):
    def post(self, request, resource_type, resource_id):
        resource = self.get_resource(resource_type, resource_id)
        serializer = ResourcePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        identity = UserIdentityService.resolve(request.user)
        subject = SubjectFactory.build(resource, resource_type=resource_type, allowed_condition_types=self.allowed_condition_types)
        password_hash = subject.password_hashes.get(CONDITION_TYPE_ENCRYPTED, "")
        if not password_hash:
            return Response({"ok": False, "message": "No password required."}, status=status.HTTP_400_BAD_REQUEST)
        if not UnlockService.verify_password(resource, identity, password_hash, serializer.validated_data["password"], resource_type=subject.resource_type):
            return Response({"ok": False, "message": "Incorrect password."}, status=status.HTTP_400_BAD_REQUEST)
        book_context = self.book_context_for_resource(resource, resource_type, request.user, serializer.validated_data.get("bookId"))
        if book_context is None:
            book_context = serializer.validated_data["book_context"]
        decision = ResourceCheckService.build_access_check(resource, request.user, book_context=book_context, resource_type=resource_type, allowed_condition_types=self.allowed_condition_types)
        return Response({"ok": True, "access_check": decision.to_dict()}, status=status.HTTP_200_OK)


class ResourceAccessFinalizeView(BaseResourceAccessView):
    def post(self, request, resource_type, resource_id):
        resource = self.get_resource(resource_type, resource_id)
        serializer = ResourcePurchaseSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        if not getattr(request.user, "is_authenticated", False):
            return Response({"ok": False, "message": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)
        identity = UserIdentityService.resolve(request.user)
        book_context = self.book_context_for_resource(resource, resource_type, request.user, serializer.validated_data.get("bookId"))
        if book_context is None:
            book_context = serializer.validated_data["book_context"]
        decision = ResourceCheckService.build_access_check(resource, request.user, book_context=book_context, resource_type=resource_type, allowed_condition_types=self.allowed_condition_types)
        if decision.all_granted:
            return Response({"ok": True, "access_check": decision.to_dict()}, status=status.HTTP_200_OK)
        if not decision.can_finalize or not decision.settlement_required:
            return Response({"ok": False, "message": "All non-money conditions must be satisfied before finalizing access."}, status=status.HTTP_400_BAD_REQUEST)
        money_condition = next(condition for condition in decision.conditions if condition.type == CONDITION_TYPE_MONEY and condition.status == STATUS_PURCHASE_REQUIRED)
        subject = SubjectFactory.build(resource, resource_type=resource_type, allowed_condition_types=self.allowed_condition_types)
        result = ResourceSettlementService.finalize(resource=resource, subject=subject, identity=identity, amount=int(money_condition.discounted_requirement or 0))
        if not result["ok"]:
            return Response({"ok": False, "message": result["message"]}, status=status.HTTP_400_BAD_REQUEST)
        updated = ResourceCheckService.build_access_check(resource, request.user, book_context=book_context, resource_type=resource_type, allowed_condition_types=self.allowed_condition_types)
        return Response({"ok": True, "access_check": updated.to_dict()}, status=status.HTTP_200_OK)
