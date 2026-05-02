from django.db import models

class History(models.Model):
    user_id = models.IntegerField()
    image = models.ImageField(upload_to='skin_images/', null=True, blank=True)
    result = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"History {self.id} for User {self.user_id}"
