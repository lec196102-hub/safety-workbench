import fileTypeConfig from '@/data/file-type-config.json';

/**
 * Get the display color for a file based on its MIME type and/or filename.
 * Uses file-type-config.json for colors and extension matchers.
 *
 * @param type - MIME type string (e.g. "image/png", "application/pdf")
 * @param name - Optional filename, used for extension-based matching
 * @returns Hex color string from the config
 */
export function getFileColor(type: string, name?: string): string {
  const { fileTypeColors, typeMatchers } = fileTypeConfig;

  // Try matching by file extension first (more reliable than MIME type)
  const ext = name ? name.split('.').pop()?.toLowerCase() : '';
  if (ext) {
    for (const matcher of typeMatchers) {
      if (matcher.extensions.includes(ext)) {
        return (
          fileTypeColors[matcher.type as keyof typeof fileTypeColors] ??
          fileTypeColors.default
        );
      }
    }
  }

  // Fall back to MIME type pattern matching
  if (type.startsWith('image/')) return fileTypeColors.image;
  if (type.includes('pdf')) return fileTypeColors.pdf;
  if (
    type.includes('sheet') ||
    type.includes('excel') ||
    type.includes('csv')
  )
    return fileTypeColors.spreadsheet;
  if (type.includes('word')) return fileTypeColors.word;

  return fileTypeColors.default;
}
