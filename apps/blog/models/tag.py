from django.db import models
from django.urls import reverse
from django.utils.text import slugify

from .base import TimeStampedModel


class Tag(TimeStampedModel):
    name = models.CharField(max_length=32, unique=True)
    slug = models.SlugField(max_length=48, unique=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    def get_absolute_url(self):
        return reverse("blog-tag-detail", kwargs={"slug": self.slug})

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)
