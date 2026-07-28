import {
  Button,
  Callout,
  Card,
  CardTitle,
  directionProps,
  MetaRow,
  StatusPill,
  Text,
} from "@infokit/ui";
import { Redirect, Stack, useRouter } from "expo-router";
import { ScrollView, View } from "react-native";

import { LoadingState } from "~/components/request-states";
import { closeSheet } from "~/lib/close-sheet";
import { usePreferences } from "~/lib/preferences";
import { useSession } from "~/lib/session";

/**
 * Who is signed in on this phone, and how to stop being.
 *
 * Every word here comes from the server with the identity, including the
 * reminder that the app reads and does not write: editing stays on the web,
 * where the audit trail and the review steps live.
 */
export default function AccountScreen() {
  const router = useRouter();
  const { strings } = usePreferences();
  const { state, busy, signOut } = useSession();

  if (state.status === "loading") {
    return (
      <View className="bg-canvas flex-1 justify-center">
        <LoadingState strings={strings} />
      </View>
    );
  }

  // Signed out — from this sheet or from another device — is the door again.
  if (state.status === "signedOut") return <Redirect href="/sign-in" />;

  const { identity } = state;
  const { labels } = identity;

  return (
    <>
      <Stack.Screen options={{ title: labels.account }} />
      <ScrollView
        className="bg-canvas flex-1"
        contentContainerClassName="gap-5 p-4 pb-16"
        {...directionProps(identity.direction)}
      >
        <View className="gap-1">
          <Text variant="title">{identity.displayName}</Text>
          <Text className="text-copy-muted">{identity.email}</Text>
        </View>

        <Callout tone="info">{labels.readOnly}</Callout>

        {/* A steward can belong to none, so the card appears only when it has
            something to say. */}
        {identity.organizations.length > 0 ? (
          <Card>
            <CardTitle>{labels.organizations}</CardTitle>
            {identity.organizations.map((organization) => (
              <View key={organization.id} className="gap-2">
                <Text className="font-semibold">{organization.name}</Text>
                <View className="flex-row">
                  <StatusPill
                    role={organization.verified ? "open" : "uncertain"}
                    label={organization.statusLabel}
                  />
                </View>
                <Text variant="muted">{organization.statusHint}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        <Card>
          <MetaRow label={labels.sessionEnds}>
            {identity.sessionEndsLabel}
          </MetaRow>
          {/* Signing out ends the session on the server, not only on the phone:
              a borrowed handset must not stay a way in. */}
          <Button
            tone="outline"
            disabled={busy}
            onPress={() => {
              void signOut();
            }}
          >
            <Text>{labels.signOut}</Text>
          </Button>
        </Card>

        <Button
          tone="quiet"
          onPress={() => {
            closeSheet(router);
          }}
        >
          <Text>{strings.close}</Text>
        </Button>
      </ScrollView>
    </>
  );
}
