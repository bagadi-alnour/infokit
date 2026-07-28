import { Button, Callout, Card, Input, Text } from "@infokit/ui";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";

import { LoadingState } from "~/components/request-states";
import { closeSheet } from "~/lib/close-sheet";
import { usePreferences } from "~/lib/preferences";
import { noticeText, useSession } from "~/lib/session";

/**
 * The members' door.
 *
 * There is no sign-in form here, and there never will be: the button opens the
 * site's own sign-in in the system browser, which already holds the allowlist,
 * the email link and the SMS step-up. What comes back is a nine-digit code — by
 * deep link when the link fires, typed by hand when it does not, which is the
 * ordinary case on a phone with no default browser set.
 */
export default function SignInScreen() {
  const router = useRouter();
  const { strings } = usePreferences();
  const { state, busy, signIn, submitCode } = useSession();
  const [code, setCode] = useState("");

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
  const notice = noticeText(state.notice, door, strings.codeInvalid);

  return (
    <ScrollView
      className="bg-canvas flex-1"
      contentContainerClassName="gap-5 p-4 pb-16"
      keyboardShouldPersistTaps="handled"
    >
      {notice ? <Callout tone="warning">{notice}</Callout> : null}

      {door ? (
        <>
          <View className="gap-2">
            <Text variant="title">{door.signInTitle}</Text>
            <Text className="text-copy-muted">{door.signInBody}</Text>
          </View>

          <Button
            disabled={busy}
            onPress={() => {
              void signIn();
            }}
          >
            <Text>{door.signInButton}</Text>
          </Button>

          {/* Said before the browser opens, not after: someone handing their
              phone around deserves to know what is kept on it. */}
          <Text variant="muted">{door.signInPrivacy}</Text>

          <Card>
            {/* The field's own label is the card's heading: saying it twice
                would read as two different things to answer. */}
            <Input
              label={strings.codeLabel}
              hint={strings.codeHint}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={11}
              // The code is nine digits in three groups: it reads the same in
              // every language, so it is never mirrored.
              style={{ writingDirection: "ltr" }}
            />
            <Button
              tone="outline"
              disabled={busy || code.replace(/\D/g, "").length !== 9}
              onPress={() => {
                void submitCode(code).then((accepted) => {
                  if (accepted) setCode("");
                });
              }}
            >
              <Text>{strings.codeSubmit}</Text>
            </Button>
          </Card>
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
