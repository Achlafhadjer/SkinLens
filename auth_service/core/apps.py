from django.apps import AppConfig
import os
import threading

class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    def ready(self):
        # Prevent running twice in some dev server configurations
        if os.environ.get('RUN_MAIN', None) != 'true':
            return
        
        def register_consul():
            try:
                import consul
                c = consul.Consul(host='consul', port=8500)
                # Register the service
                c.agent.service.register(
                    name='auth-service',
                    service_id='auth-service-1',
                    address='auth-service',
                    port=8000,
                    tags=['django', 'auth']
                )
                print("Auth Service successfully registered to Consul!")
            except Exception as e:
                print(f"Failed to register to Consul: {e}")
        
        # Run in a thread so it doesn't block startup
        threading.Thread(target=register_consul, daemon=True).start()
