import { useState } from 'react';
import { View } from 'react-native';
import { Body, Button, Caption } from './ui';
import { Chip, ChipRow, ErrorText } from './admin-ui';
import {
  openStoredFile,
  pickFile,
  type Bucket,
  type PickSource,
  type PickedFile,
} from '../lib/storage';
import { spacing } from '../lib/theme';

/**
 * Take a photo, choose an image, or choose a PDF. The file is only held here;
 * the caller uploads it when the form is saved, so a cancelled form leaves
 * nothing behind in storage.
 */
export function FilePickerField({
  label,
  file,
  onChange,
  existingLabel,
  allowPdf = true,
}: {
  label: string;
  file: PickedFile | null;
  onChange: (file: PickedFile | null) => void;
  /** Shown when nothing new is picked but a file is already stored. */
  existingLabel?: string | null;
  allowPdf?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);

  const choose = async (source: PickSource) => {
    setError(null);
    const result = await pickFile(source);
    if (!result) return;
    if ('error' in result) {
      setError(result.error);
      return;
    }
    onChange(result);
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <Body>{label}</Body>
      {file ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Caption>📎 {file.name}</Caption>
          </View>
          <Chip label="Remove" onPress={() => onChange(null)} />
        </View>
      ) : existingLabel ? (
        <Caption>{existingLabel}</Caption>
      ) : null}
      <ChipRow>
        <Chip label="Take photo" onPress={() => void choose('camera')} />
        <Chip label="Choose image" onPress={() => void choose('library')} />
        {allowPdf ? <Chip label="Choose PDF" onPress={() => void choose('pdf')} /> : null}
      </ChipRow>
      <ErrorText message={error} />
    </View>
  );
}

/**
 * Opens a stored bill or screenshot through a short-lived signed link.
 *
 * A full-width button rather than the chip this used to be. The picture is the
 * evidence — it is what a committee member checks a payment against, and what
 * a resident opens to see the bill behind a line in the ledger. A chip the size
 * of a filter, sitting in a row of filters, is not what the most important
 * control on the card should look like.
 */
export function ViewFileButton({
  bucket,
  value,
  label,
}: {
  bucket: Bucket;
  value: string | null | undefined;
  label: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!value) return null;

  return (
    <View style={{ gap: spacing.xs }}>
      <Button
        label={busy ? 'Opening…' : label}
        variant="secondary"
        loading={busy}
        onPress={() => {
          setBusy(true);
          setError(null);
          void openStoredFile(bucket, value)
            .then((message) => setError(message))
            .catch(() => setError('Could not open that file.'))
            .finally(() => setBusy(false));
        }}
      />
      {error ? <Caption>{error}</Caption> : null}
    </View>
  );
}
