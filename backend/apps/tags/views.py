from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import TagDirectorySerializer
from .services import TagDirectoryService


class TagDirectoryView(APIView):
    def get(self, request):
        query = (request.query_params.get("query") or "").strip()
        tags = TagDirectoryService.list_tags(query=query)
        return Response({"items": TagDirectorySerializer(tags, many=True).data, "total": tags.count()})
