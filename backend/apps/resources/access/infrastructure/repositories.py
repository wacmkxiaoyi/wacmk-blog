from django.apps import apps


class ResourceRepository:
    RESOURCE_MODEL_MAP = {}

    @classmethod
    def register(cls, resource_type, model_label):
        cls.RESOURCE_MODEL_MAP[resource_type] = model_label

    @classmethod
    def get_resource(cls, resource_type, resource_id):
        model_label = cls.RESOURCE_MODEL_MAP.get(resource_type)
        if not model_label:
            return None
        model = apps.get_model(model_label)
        return model.objects.filter(pk=resource_id).first()
