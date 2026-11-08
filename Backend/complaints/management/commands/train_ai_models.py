from django.conf import settings
from django.core.management.base import BaseCommand

from complaints.ai.trainer import ComplaintModelTrainer


class Command(BaseCommand):
    help = 'Train UCMS AI models using incremental learning on large datasets (up to millions of rows).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--samples',
            type=int,
            default=0,
            help='Limit number of rows used for training (0 = use full dataset file).',
        )
        parser.add_argument(
            '--data-path',
            type=str,
            default='',
            help='Optional training CSV path. Defaults to AI training data directory.',
        )
        parser.add_argument(
            '--generate-if-missing',
            action='store_true',
            help='Generate a default 100k sample dataset if training CSV is missing.',
        )

    def handle(self, *args, **options):
        data_path = settings.AI_TRAINING_DATA_PATH if not options['data_path'] else settings.BASE_DIR / options['data_path']
        models_dir = settings.AI_MODELS_DIR

        if not data_path.exists():
            if options['generate_if_missing']:
                from complaints.ai.dataset_generator import write_training_csv

                self.stdout.write('Training data missing. Generating default 100,000 samples...')
                write_training_csv(data_path, total_samples=100_000)
            else:
                self.stdout.write(
                    self.style.ERROR(
                        f'Training data not found at {data_path}. '
                        'Run: python manage.py generate_training_data --samples 1000000'
                    )
                )
                return

        max_samples = options['samples'] if options['samples'] > 0 else None
        trainer = ComplaintModelTrainer(models_dir=models_dir, data_path=data_path)

        self.stdout.write('Training AI models with incremental SGD classifiers...')
        metadata = trainer.train_from_csv(max_samples=max_samples)

        from complaints.ai.services import reload_ai_engine

        reload_ai_engine()
        self.stdout.write(self.style.SUCCESS('AI model training completed.'))
        self.stdout.write(f"Version: {metadata.get('version')}")
        self.stdout.write(f"Samples trained: {metadata.get('samples_trained'):,}")
        self.stdout.write(f"Category accuracy: {metadata.get('category_accuracy')}")
        self.stdout.write(f"Priority accuracy: {metadata.get('priority_accuracy')}")
        self.stdout.write(f"Sentiment accuracy: {metadata.get('sentiment_accuracy')}")
        self.stdout.write(f"Intent accuracy: {metadata.get('intent_accuracy')}")
