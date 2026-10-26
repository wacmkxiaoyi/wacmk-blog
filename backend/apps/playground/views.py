from django.http import HttpResponse


def playground_page(request):
    """Reserve a Django endpoint for development-only frontend playground pages."""
    return HttpResponse(status=204)
