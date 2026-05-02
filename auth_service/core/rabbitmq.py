import pika
import json
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

def publish_event(event_type, data):
    try:
        # Configuration for connecting to RabbitMQ
        connection = pika.BlockingConnection(pika.ConnectionParameters(host='rabbitmq', port=5672))
        channel = connection.channel()
        
        # We declare a fanout exchange, meaning all queues bound to it receive the message
        # Or a topic exchange. Let's use topic.
        channel.exchange_declare(exchange='skin_ai_events', exchange_type='topic')
        
        # Prepare the message payload
        message = {
            'event': event_type,
            'data': data
        }
        
        # Publish the event
        channel.basic_publish(
            exchange='skin_ai_events',
            routing_key=event_type,
            body=json.dumps(message)
        )
        logger.info(f"Published event '{event_type}' to RabbitMQ.")
        connection.close()
    except Exception as e:
        logger.error(f"Failed to publish event to RabbitMQ: {e}")
