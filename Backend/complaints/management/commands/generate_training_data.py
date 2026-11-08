from django.conf import settings
from django.core.management.base import BaseCommand

from complaints.ai.dataset_generator import write_training_csv


class Command(BaseCommand):
    help = 'Generate large-scale synthetic complaint/chat training data (supports millions of samples).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--samples',
            type=int,
            default=100_000,
            help='Number of training records to generate (e.g. 1000000 for 1 million).',
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=100_000,
            help='CSV write batch size for memory efficiency.',
        )
        parser.add_argument(
            '--output',
            type=str,
            default='',
            help='Optional output CSV path. Defaults to AI training data directory.',
        )
        parser.add_argument('--seed', type=int, default=42, help='Random seed for reproducibility.')

    def handle(self, *args, **options):
        samples = options['samples']
        batch_size = options['batch_size']
        seed = options['seed']

        output = options['output']
        output_path = settings.AI_TRAINING_DATA_PATH if not output else settings.BASE_DIR / output

        self.stdout.write(f'Generating {samples:,} training samples...')
        write_training_csv(output_path, total_samples=samples, batch_size=batch_size, seed=seed)
        self.stdout.write(self.style.SUCCESS(f'Training dataset saved to {output_path}'))
