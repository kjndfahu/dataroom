import { BadRequestException } from '@nestjs/common';

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g;
const PATH_SEPARATORS = /[/\\]/g;

/**
 * Normalises a user-supplied folder or file name.
 *
 * Names are display data only — storage keys are generated separately — but
 * they still have to be free of path separators and control characters so they
 * cannot be used for traversal or to break headers.
 */
export function normalizeName(raw: string): string {
  const cleaned = raw
    .replace(CONTROL_CHARACTERS, '')
    .replace(PATH_SEPARATORS, '-')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length === 0) {
    throw new BadRequestException('Name cannot be empty.');
  }

  if (cleaned === '.' || cleaned === '..') {
    throw new BadRequestException('That name is not allowed.');
  }

  if (cleaned.length > 255) {
    throw new BadRequestException('Name must be 255 characters or fewer.');
  }

  return cleaned;
}

/** Splits "contract.pdf" into ["contract", ".pdf"]; a dotfile keeps its name. */
export function splitExtension(name: string): [string, string] {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return [name, ''];
  return [name.slice(0, dot), name.slice(dot)];
}

/**
 * Produces "contract (1).pdf", "contract (2).pdf", … skipping names already
 * taken in the destination folder.
 */
export function buildUniqueName(name: string, taken: Set<string>): string {
  if (!taken.has(name)) return name;

  const [base, extension] = splitExtension(name);
  // Re-numbering an existing "contract (1).pdf" avoids "contract (1) (1).pdf".
  const stripped = base.replace(/ \(\d+\)$/, '');

  for (let counter = 1; counter < 10_000; counter++) {
    const candidate = `${stripped} (${counter})${extension}`;
    if (!taken.has(candidate)) return candidate;
  }

  throw new BadRequestException(
    'Too many files share that name in this folder.',
  );
}
