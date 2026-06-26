// src/features/settings/components/ProfileSection.tsx
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Textarea } from '@/components/ui/Textarea';
import { useMe } from '../hooks/useMe';
import { useUpdateProfile } from '../hooks/useUpdateProfile';
import { useUploadAvatar, useDeleteAvatar } from '../hooks/useAvatar';
import {
  MAX_BIO,
  profileSchema,
  validateAvatarFile,
  type ProfileFormValues,
} from '../schemas';

/** Edit account / profile: avatar, display name, bio (FR-11). */
export function ProfileSection() {
  const { data: me } = useMe();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const deleteAvatar = useDeleteAvatar();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [errors, setErrors] = useState<Partial<ProfileFormValues>>({});
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // Seed the form from the loaded profile (and reset on external changes).
  useEffect(() => {
    if (me) {
      setDisplayName(me.displayName);
      setBio(me.bio ?? '');
    }
  }, [me]);

  const dirty = me
    ? displayName !== me.displayName || bio !== (me.bio ?? '')
    : false;

  // Unsaved-changes guard: warn before a refresh / tab close with pending edits.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const result = profileSchema.safeParse({ displayName, bio });
    if (!result.success) {
      const fieldErrors: Partial<ProfileFormValues> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (key === 'displayName' || key === 'bio') fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    const trimmedBio = result.data.bio.trim();
    updateProfile.mutate({
      displayName: result.data.displayName,
      bio: trimmedBio === '' ? null : trimmedBio,
    });
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    const error = validateAvatarFile(file);
    if (error) {
      setAvatarError(error);
      return;
    }
    setAvatarError(null);
    uploadAvatar.mutate(file);
  }

  const avatarBusy = uploadAvatar.isPending || deleteAvatar.isPending;

  return (
    <section aria-labelledby="profile-heading" className="flex flex-col gap-5">
      <h2
        id="profile-heading"
        className="text-base font-semibold text-text-normal"
      >
        Profile
      </h2>

      {/* Avatar uploader */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar
            name={me?.displayName ?? 'You'}
            src={me?.avatarUrl ?? undefined}
            size="lg"
          />
          {avatarBusy && (
            <span className="absolute inset-0 flex items-center justify-center rounded-avatar bg-bg-deepest/70">
              <Spinner label="Updating avatar" />
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarBusy}
            >
              Change avatar
            </Button>
            {me?.avatarUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => deleteAvatar.mutate()}
                disabled={avatarBusy}
              >
                Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-text-muted">PNG, JPEG, GIF or WebP, up to 5 MB.</p>
          {avatarError && (
            <p role="alert" className="text-xs text-danger">
              {avatarError}
            </p>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="hidden"
          aria-label="Upload avatar"
          onChange={handleAvatarChange}
        />
      </div>

      {/* Profile fields */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Input
          label="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          error={errors.displayName}
          maxLength={80}
        />

        <Input
          label="Username"
          value={me ? `@${me.username}` : ''}
          readOnly
          disabled
          helperText="Your username can't be changed."
        />

        <Textarea
          label="Bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          error={errors.bio}
          counter={`${bio.length}/${MAX_BIO}`}
          rows={3}
          placeholder="Tell people a little about yourself"
        />

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={!dirty} isLoading={updateProfile.isPending}>
            Save changes
          </Button>
          {dirty && (
            <span className="text-xs text-text-muted">You have unsaved changes.</span>
          )}
        </div>
      </form>
    </section>
  );
}
