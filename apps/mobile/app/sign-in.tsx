import { Button, Callout, Card, Input, Text } from "@infokit/ui";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";

import { LoadingState } from "~/components/request-states";
import { closeSheet } from "~/lib/close-sheet";
import { usePreferences } from "~/lib/preferences";
import { noticeText, useSession, type SecondFactorKind } from "~/lib/session";

/**
 * The members' door.
 *
 * It used to be a button that opened the website in the system browser, plus a
 * field for the nine digits that came back. The app signs in for itself now —
 * password or emailed link, with the second factor in place if the account holds
 * one — so this is a real sign-in rather than a hand-off.
 *
 * What has not changed is who may pass: the platform is invitation-only, and the
 * refusal for an address nobody recorded is the same one a wrong password gets.
 * This screen never says which it was.
 */
export default function SignInScreen() {
  const router = useRouter();
  const { strings } = usePreferences();
  const {
    state,
    busy,
    pendingSecondFactor,
    signIn,
    sendMagicLink,
    sendSmsCode,
    submitSecondFactor,
    cancelSecondFactor,
  } = useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<SecondFactorKind>("totp");
  const [linkSent, setLinkSent] = useState(false);
  const [smsSent, setSmsSent] = useState(false);

  // Signing in is the whole purpose of this sheet: once it worked, it closes.
  if (state.status === "signedIn") return <Redirect href="/account" />;

  if (state.status === "loading") {
    return (
      <View className="bg-canvas flex-1 justify-center">
        <LoadingState strings={strings} />
      </View>
    );
  }

  const { door } = state;
  const notice = noticeText(state.notice, door, {
    invalidCredentials: strings.invalidCredentials,
    offline: strings.offlineBody,
  });

  /**
   * The second factor, asked for after the password was accepted and before any
   * session exists. It replaces the whole screen rather than appearing under the
   * form: there is nothing left to do with those fields, and leaving them on
   * screen invites a second attempt that would start the whole thing over.
   */
  if (pendingSecondFactor) {
    const digits = kind === "backup" ? null : 6;
    return (
      <ScrollView
        className="bg-canvas flex-1"
        contentContainerClassName="gap-5 p-4 pb-16"
        keyboardShouldPersistTaps="handled"
      >
        {notice ? <Callout tone="warning">{notice}</Callout> : null}

        <View className="gap-2">
          <Text variant="title">{strings.twoFactorTitle}</Text>
          <Text className="text-copy-muted">{strings.twoFactorBody}</Text>
        </View>

        <Card>
          <Input
            label={
              kind === "backup"
                ? strings.twoFactorBackupLabel
                : kind === "otp"
                  ? strings.twoFactorSmsLabel
                  : strings.twoFactorTotpLabel
            }
            value={code}
            onChangeText={setCode}
            keyboardType={kind === "backup" ? "default" : "number-pad"}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            autoCapitalize="none"
            {...(digits ? { maxLength: digits } : {})}
            // A code reads the same in every language, so it is never mirrored.
            style={{ writingDirection: "ltr" }}
          />
          <Button
            disabled={
              busy ||
              (digits
                ? code.replace(/\D/g, "").length !== digits
                : code.trim().length === 0)
            }
            onPress={() => {
              void submitSecondFactor(kind, code).then((accepted) => {
                if (accepted) setCode("");
              });
            }}
          >
            <Text>{strings.twoFactorSubmit}</Text>
          </Button>
        </Card>

        {/* Offered only when the account can actually receive one, so the button
            is never a dead end. */}
        {pendingSecondFactor.otp && kind !== "backup" ? (
          <Button
            tone="outline"
            disabled={busy}
            onPress={() => {
              setKind("otp");
              setCode("");
              void sendSmsCode().then(setSmsSent);
            }}
          >
            <Text>{strings.twoFactorSendSms}</Text>
          </Button>
        ) : null}
        {smsSent ? (
          <Callout tone="info">{strings.twoFactorSmsLabel}</Callout>
        ) : null}

        <Button
          tone="quiet"
          disabled={busy}
          onPress={() => {
            setKind(kind === "backup" ? "totp" : "backup");
            setCode("");
          }}
        >
          <Text>
            {kind === "backup"
              ? strings.twoFactorUseCode
              : strings.twoFactorUseBackup}
          </Text>
        </Button>

        <Button
          tone="quiet"
          disabled={busy}
          onPress={() => {
            setCode("");
            setKind("totp");
            setSmsSent(false);
            cancelSecondFactor();
          }}
        >
          <Text>{strings.twoFactorCancel}</Text>
        </Button>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      className="bg-canvas flex-1"
      contentContainerClassName="gap-5 p-4 pb-16"
      keyboardShouldPersistTaps="handled"
    >
      {notice ? <Callout tone="warning">{notice}</Callout> : null}
      {linkSent ? <Callout tone="info">{strings.magicLinkSent}</Callout> : null}

      {door ? (
        <>
          <View className="gap-2">
            <Text variant="title">{door.signInTitle}</Text>
            <Text className="text-copy-muted">{door.signInBody}</Text>
          </View>

          <Card>
            <Input
              label={strings.emailLabel}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              autoCapitalize="none"
              autoCorrect={false}
              style={{ writingDirection: "ltr" }}
            />
            <Input
              label={strings.passwordLabel}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              autoCapitalize="none"
              style={{ writingDirection: "ltr" }}
            />
            <Button
              disabled={busy || !email.trim() || !password}
              onPress={() => {
                setLinkSent(false);
                void signIn({ email, password }).then((outcome) => {
                  if (outcome !== "failed") setPassword("");
                });
              }}
            >
              <Text>{strings.signInSubmit}</Text>
            </Button>
          </Card>

          {/* The way in most people here use, and the one that needs no password
              at all — so it is a peer of the form, not a footnote under it. */}
          <Button
            tone="outline"
            disabled={busy || !email.trim()}
            onPress={() => {
              void sendMagicLink(email).then(setLinkSent);
            }}
          >
            <Text>{strings.magicLinkSubmit}</Text>
          </Button>

          {/* Said before anything is sent, not after: someone handing their
              phone around deserves to know what is kept on it. */}
          <Text variant="muted">{door.signInPrivacy}</Text>
        </>
      ) : (
        // The door's words live on the server, so an unreachable service means
        // there is nothing honest to put here.
        <Callout tone="warning" title={strings.failedTitle}>
          {strings.offlineBody}
        </Callout>
      )}

      <Button
        tone="quiet"
        onPress={() => {
          closeSheet(router);
        }}
      >
        <Text>{strings.close}</Text>
      </Button>
    </ScrollView>
  );
}
