from django.contrib.auth.models import Group
from django.test import TestCase

from apps.authorization_core.application.balance_provider import BalanceSnapshot, DefaultIdentityBalanceProvider
from apps.authorization_core.application.user_identity_service import UserIdentityService
from apps.users.models import User


class StubBalanceProvider:
    def __init__(self, *, money=0, points=0):
        self.snapshot = BalanceSnapshot(money_balance=money, points_balance=points)

    def get_balances(self, user):
        return self.snapshot


class UserIdentityServiceTests(TestCase):
    def tearDown(self):
        UserIdentityService.balance_provider = DefaultIdentityBalanceProvider()

    def test_guest_identity(self):
        identity = UserIdentityService.resolve(None)
        self.assertFalse(identity.is_authenticated)
        self.assertEqual(identity.user_id, None)

    def test_default_balances_are_zero(self):
        user = User.objects.create_user(username="tester", email="tester@example.com", password="secret123")
        UserIdentityService.balance_provider = StubBalanceProvider()
        identity = UserIdentityService.resolve(user)
        self.assertTrue(identity.is_authenticated)
        self.assertEqual(identity.money_balance, 0)

    def test_default_provider_reads_user_balances(self):
        user = User.objects.create_user(
            username="balances", email="balances@example.com", password="secret123",
            money_balance=120, points_balance=45,
        )
        snapshot = DefaultIdentityBalanceProvider().get_balances(user)
        self.assertEqual(snapshot.money_balance, 120)
        self.assertEqual(snapshot.points_balance, 45)

    def test_vip_groups_are_resolved(self):
        user = User.objects.create_user(username="vipuser", email="vip@example.com", password="secret123")
        vip1, _ = Group.objects.get_or_create(name="vip_1")
        vip3, _ = Group.objects.get_or_create(name="vip_3")
        user.groups.add(vip1, vip3)
        UserIdentityService.balance_provider = StubBalanceProvider(money=100, points=50)
        identity = UserIdentityService.resolve(user)
        self.assertTrue(identity.is_vip)
        self.assertEqual(identity.vip_level, 3)
        self.assertIn("vip_1", identity.group_names)
        self.assertEqual(identity.money_balance, 100)
        self.assertEqual(str(identity.money_discount), "0.30")
        self.assertEqual(str(identity.points_discount), "0.15")
