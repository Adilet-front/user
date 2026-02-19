import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  getProfile,
  requestEmailUpdate,
} from "../../entities/user/api/userApi";
import { getEmailValidationError } from "../../shared/lib/auth/emailValidation";
import styles from "./ProfileSettingsPage.module.scss";

export const ProfileCredentialsPage = () => {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: getProfile,
  });
  const [newEmail, setNewEmail] = useState("");
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);

  const requestEmailUpdateMutation = useMutation({
    mutationFn: requestEmailUpdate,
    onSuccess: (message) => {
      setResultMessage(message || t("profile.messages.emailRequested"));
      setResultError(null);
      setNewEmail("");
    },
    onError: () => {
      setResultError(t("profile.errors.emailRequest"));
      setResultMessage(null);
    },
  });

  if (isLoading) {
    return (
      <section className={styles.page}>
        <div className={styles.header}>
          <h1>{t("profile.sections.email")}</h1>
          <p>{t("common.loading")}</p>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <h1>{t("profile.sections.email")}</h1>
        <p>{t("profile.subtitle")}</p>
      </div>

      <div className={styles.card}>
        <div>
          <h3>{t("profile.fields.currentEmail")}</h3>
          <p>{data?.email ?? t("common.notAvailable")}</p>
        </div>
      </div>

      <form
        className={styles.card}
        onSubmit={(event) => {
          event.preventDefault();
          const normalized = newEmail.trim();
          if (!normalized) {
            setResultError(t("profile.errors.emailRequired"));
            setResultMessage(null);
            return;
          }

          const emailValidationError = getEmailValidationError(normalized);
          if (emailValidationError) {
            setResultError(
              emailValidationError === "missingDomainDot"
                ? t("profile.errors.emailDomainDotMissing")
                : t("profile.errors.emailInvalid"),
            );
            setResultMessage(null);
            return;
          }

          requestEmailUpdateMutation.mutate(normalized);
        }}
      >
        <div>
          <h3>{t("profile.sections.email")}</h3>
          <p>{t("profile.actions.requestEmail")}</p>
          <input
            type="email"
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
            placeholder="new-email@example.com"
          />
        </div>
        <button type="submit" className={styles.actionButton}>
          {requestEmailUpdateMutation.isPending ? t("profile.sending") : t("profile.actions.requestEmail")}
        </button>
      </form>

      {resultError ? <p className="text-danger">{resultError}</p> : null}
      {resultMessage ? <p className="text-success">{resultMessage}</p> : null}
    </section>
  );
};

export default ProfileCredentialsPage;
