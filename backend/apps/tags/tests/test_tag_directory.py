from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.tags.models import Tag


class TagDirectoryApiTests(APITestCase):
    url = "/api/tags/"

    def setUp(self):
        self.user = get_user_model().objects.create_user(username="reader", email="reader@example.com", password="password")

    def test_requires_authentication(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_returns_tags_sorted_by_name_with_placeholder_post_counts(self):
        zebra = Tag.objects.create(name="Zebra")
        alpha = Tag.objects.create(name="Alpha")
        self.client.force_authenticate(self.user)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total"], 2)
        self.assertEqual(response.data["items"], [
            {"id": alpha.id, "name": "Alpha", "post_count": 0},
            {"id": zebra.id, "name": "Zebra", "post_count": 0},
        ])

    def test_filters_by_trimmed_case_insensitive_name_query(self):
        react = Tag.objects.create(name="React")
        Tag.objects.create(name="Django")
        self.client.force_authenticate(self.user)

        response = self.client.get(self.url, {"query": "  ACT "})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in response.data["items"]], [react.id])
