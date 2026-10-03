import { useState } from 'react';
import { Image, Modal, Pressable, Text, View } from 'react-native';
import { Paperclip, X } from 'lucide-react-native';
import { Body, Button, Caption } from './ui';
import { Chip, ChipRow, ErrorText } from './admin-ui';
import {
  isStoredImage,
  openStoredFile,
  pickFile,
  storedFileUrl,
  type Bucket,
  type PickSource,
  type PickedFile,
} from '../lib/storage';
import { minTapTarget, spacing } from '../lib/theme';
import { useTheme } from '../lib/use-theme';

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
  const { colors } = useTheme();
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
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Paperclip size={14} color={colors.inkMuted} strokeWidth={1.8} />
            <View style={{ flexShrink: 1 }}>
              <Caption>{file.name}</Caption>
            </View>
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
  const { colors } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // A photo opens in a window over the screen; a PDF in the in-app browser,
  // which draws it properly. Either way the person never leaves the app.
  const [photo, setPhoto] = useState<string | null>(null);
  if (!value) return null;

  const open = () => {
    setBusy(true);
    setError(null);
    const opening = isStoredImage(value)
      ? storedFileUrl(bucket, value).then((result) => {
          if ('error' in result) return result.error;
          setPhoto(result.url);
          return null;
        })
      : openStoredFile(bucket, value);
    void opening
      .then((message) => setError(message))
      .catch(() => setError('Could not open that file.'))
      .finally(() => setBusy(false));
  };

  return (
    <View style={{ gap: spacing.xs }}>
      <Button label={busy ? 'Opening…' : label} variant="secondary" loading={busy} onPress={open} />
      {error ? <Caption>{error}</Caption> : null}
      <Modal
        visible={photo !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPhoto(null)}
        statusBarTranslucent
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.85)',
            justifyContent: 'center',
            padding: spacing.lg,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: spacing.md,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>
              {label.replace(/^View (\w)/, (_, first: string) => first.toUpperCase())}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={() => setPhoto(null)}
              hitSlop={12}
              style={{
                minWidth: minTapTarget,
                minHeight: minTapTarget,
                alignItems: 'flex-end',
                justifyContent: 'center',
              }}
            >
              <X color="#fff" size={22} strokeWidth={2} />
            </Pressable>
          </View>
          {photo ? (
            <Image
              source={{ uri: photo }}
              resizeMode="contain"
              accessibilityLabel={label.replace(/^View /, '')}
              style={{ flex: 1, width: '100%', backgroundColor: colors.surfaceSunken }}
              onError={() => {
                setPhoto(null);
                setError('Could not show that file. Pull down to refresh and try again.');
              }}
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}
