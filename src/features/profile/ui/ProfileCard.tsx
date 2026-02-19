import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../auth/model/useAuth";
import {
  getProfile,
  requestEmailUpdate,
  updateProfile,
  uploadAvatar,
} from "../../../entities/user/api/userApi";
import { resolveAvatarUrl } from "../../../shared/lib/media/avatar";
import { getEmailValidationError } from "../../../shared/lib/auth/emailValidation";

export const ProfileCard = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { signIn } = useAuth();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["me"],
    queryFn: getProfile,
  });

  const [firstNameDraft, setFirstNameDraft] = useState<string | null>(null);
  const [lastNameDraft, setLastNameDraft] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  const firstName = firstNameDraft ?? data?.firstName ?? "";
  const lastName = lastNameDraft ?? data?.lastName ?? "";
  const avatarPreview = useMemo(
    () => (avatarFile ? URL.createObjectURL(avatarFile) : null),
    [avatarFile],
  );
  const profileAvatarUrl = useMemo(
    () => resolveAvatarUrl(data?.avatarUrl),
    [data?.avatarUrl],
  );
  const avatarSrc = avatarPreview || (avatarLoadFailed ? null : profileAvatarUrl);

  useEffect(() => {
    return () => {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [profileAvatarUrl, avatarPreview]);

  const updateProfileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: async (updatedProfile) => {
      setProfileMessage(t("profile.messages.nameUpdated"));
      setProfileError(null);
      queryClient.setQueryData(["me"], updatedProfile);
      setFirstNameDraft(updatedProfile.firstName ?? "");
      setLastNameDraft(updatedProfile.lastName ?? "");
      await signIn();
    },
    onError: () => {
      setProfileError(t("profile.errors.nameUpdate"));
      setProfileMessage(null);
    },
  });

  const requestEmailUpdateMutation = useMutation({
    mutationFn: requestEmailUpdate,
    onSuccess: (message) => {
      setEmailMessage(message || t("profile.messages.emailRequested"));
      setEmailError(null);
      setNewEmail("");
    },
    onError: () => {
      setEmailError(t("profile.errors.emailRequest"));
      setEmailMessage(null);
    },
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: uploadAvatar,
    onSuccess: async (message) => {
      setAvatarMessage(message || t("profile.messages.avatarUpdated"));
      setAvatarError(null);
      setAvatarFile(null);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      await signIn();
    },
    onError: () => {
      setAvatarError(t("profile.errors.avatarUpload"));
      setAvatarMessage(null);
    },
  });

  const handleAvatarSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setAvatarError(t("profile.errors.avatarType"));
      setAvatarMessage(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAvatarError(t("profile.errors.avatarSize"));
      setAvatarMessage(null);
      return;
    }

    setAvatarFile(file);
    setAvatarError(null);
    setAvatarMessage(null);
  };

  const handleProfileSubmit = () => {
    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();

    if (!normalizedFirstName || !normalizedLastName) {
      setProfileError(t("profile.errors.nameRequired"));
      setProfileMessage(null);
      return;
    }

    if (
      normalizedFirstName === (data?.firstName ?? "") &&
      normalizedLastName === (data?.lastName ?? "")
    ) {
      setProfileMessage(t("profile.messages.noChanges"));
      setProfileError(null);
      return;
    }

    updateProfileMutation.mutate({
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
    });
  };

  const handleEmailSubmit = () => {
    const normalizedEmail = newEmail.trim();
    if (!normalizedEmail) {
      setEmailError(t("profile.errors.emailRequired"));
      setEmailMessage(null);
      return;
    }

    const emailValidationError = getEmailValidationError(normalizedEmail);
    if (emailValidationError) {
      setEmailError(
        emailValidationError === "missingDomainDot"
          ? t("profile.errors.emailDomainDotMissing")
          : t("profile.errors.emailInvalid"),
      );
      setEmailMessage(null);
      return;
    }

    if (normalizedEmail === data?.email) {
      setEmailError(t("profile.errors.sameEmail"));
      setEmailMessage(null);
      return;
    }

    requestEmailUpdateMutation.mutate(normalizedEmail);
  };

  const handleAvatarSubmit = () => {
    if (!avatarFile) {
      setAvatarError(t("profile.errors.avatarRequired"));
      setAvatarMessage(null);
      return;
    }

    uploadAvatarMutation.mutate(avatarFile);
  };

  if (isLoading) {
    return (
      <section className="profile">
        <header className="profile-header">
          <div>
            <h1>{t("profile.title")}</h1>
            <p>{t("common.loading")}</p>
          </div>
        </header>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className="profile">
        <header className="profile-header">
          <div>
            <h1>{t("profile.title")}</h1>
            <p>{t("profile.errors.load")}</p>
          </div>
        </header>
      </section>
    );
  }

  const isSaving =
    updateProfileMutation.isPending || uploadAvatarMutation.isPending;

  return (
    <section className="profile">
      <header className="profile-header">
        <div>
          <h1>{t("profile.title")}</h1>
          <p>{t("profile.subtitle")}</p>
        </div>
      </header>

      <div className="tabs">
        <button className="tab is-active" type="button">
          {t("profile.tab")}
        </button>
      </div>

      <article className="profile-card">
        <div>
          <h3>
            {data.firstName || data.lastName
              ? `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim()
              : t("profile.nameMissing")}
          </h3>
          <p className="muted">{data.email}</p>
          <p className="muted">
            {t("profile.role")}: {data.role}
          </p>
        </div>
        {avatarSrc ? (
          <div className="avatar-preview" style={{ width: 72, height: 72 }}>
            <img
              src={avatarSrc}
              alt={t("profile.avatarAlt")}
              className="avatar-preview-image"
              onError={() => {
                if (!avatarPreview) {
                  setAvatarLoadFailed(true);
                }
              }}
            />
          </div>
        ) : (
          <div className="avatar-preview" style={{ width: 72, height: 72 }} />
        )}
      </article>

      <form
        className="profile-form"
        onSubmit={(event) => {
          event.preventDefault();
          handleProfileSubmit();
        }}
      >
        <h3>{t("profile.sections.name")}</h3>
        <div className="profile-fields">
          <label className="field">
            <span>{t("profile.fields.email")}</span>
            <input type="email" value={data.email} readOnly />
          </label>
          <label className="field">
            <span>{t("profile.fields.firstName")}</span>
            <input
              type="text"
              value={firstName}
              onChange={(event) => setFirstNameDraft(event.target.value)}
              maxLength={80}
            />
          </label>
          <label className="field">
            <span>{t("profile.fields.lastName")}</span>
            <input
              type="text"
              value={lastName}
              onChange={(event) => setLastNameDraft(event.target.value)}
              maxLength={80}
            />
          </label>
          <label className="field">
            <span>{t("profile.fields.role")}</span>
            <input type="text" value={data.role} readOnly />
          </label>
        </div>
        {profileError ? <p className="text-danger">{profileError}</p> : null}
        {profileMessage ? <p className="text-success">{profileMessage}</p> : null}
        <div className="profile-actions">
          <button
            className="button primary"
            type="submit"
            disabled={updateProfileMutation.isPending}
          >
            {updateProfileMutation.isPending
              ? t("profile.saving")
              : t("profile.actions.saveName")}
          </button>
        </div>
      </form>

      <form
        className="profile-form"
        onSubmit={(event) => {
          event.preventDefault();
          handleEmailSubmit();
        }}
      >
        <h3>{t("profile.sections.email")}</h3>
        <div className="profile-fields">
          <label className="field">
            <span>{t("profile.fields.currentEmail")}</span>
            <input type="email" value={data.email} readOnly />
          </label>
          <label className="field">
            <span>{t("profile.fields.newEmail")}</span>
            <input
              type="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              placeholder="new-email@example.com"
              maxLength={120}
            />
          </label>
        </div>
        {emailError ? <p className="text-danger">{emailError}</p> : null}
        {emailMessage ? <p className="text-success">{emailMessage}</p> : null}
        <div className="profile-actions">
          <button
            className="button primary"
            type="submit"
            disabled={requestEmailUpdateMutation.isPending}
          >
            {requestEmailUpdateMutation.isPending
              ? t("profile.sending")
              : t("profile.actions.requestEmail")}
          </button>
        </div>
      </form>

      <form
        className="profile-form"
        onSubmit={(event) => {
          event.preventDefault();
          handleAvatarSubmit();
        }}
      >
        <h3>{t("profile.sections.avatar")}</h3>
        <div className="profile-fields">
          <label className="field">
            <span>{t("profile.fields.image")}</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarSelect}
              disabled={uploadAvatarMutation.isPending}
            />
            <small className="muted">{t("profile.avatarHint")}</small>
          </label>
          <div className="field">
            <span>{t("profile.fields.preview")}</span>
            {avatarSrc ? (
              <div className="avatar-preview">
                <img
                  src={avatarSrc}
                  alt={t("profile.avatarPreviewAlt")}
                  className="avatar-preview-image"
                  onError={() => {
                    if (!avatarPreview) {
                      setAvatarLoadFailed(true);
                    }
                  }}
                />
              </div>
            ) : (
              <p className="muted">{t("profile.avatarMissing")}</p>
            )}
          </div>
        </div>
        {avatarError ? <p className="text-danger">{avatarError}</p> : null}
        {avatarMessage ? <p className="text-success">{avatarMessage}</p> : null}
        <div className="profile-actions">
          <button className="button primary" type="submit" disabled={isSaving}>
            {uploadAvatarMutation.isPending
              ? t("profile.uploading")
              : t("profile.actions.uploadAvatar")}
          </button>
        </div>
      </form>
    </section>
  );
};
