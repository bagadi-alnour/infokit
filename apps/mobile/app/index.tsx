import type {
  PublicActivityStatus,
  PublicActivitySummary,
} from "@infokit/shared/public-content";
import {
  Button,
  Callout,
  Card,
  CardDescription,
  CardTitle,
  Chip,
  MetaRow,
  StatusPill,
  Text,
} from "@infokit/ui";
import { Link, Stack } from "expo-router";
import { ScrollView, View } from "react-native";

/**
 * Placeholder payload in the exact shape the API already serves the web app
 * (`PublicActivitySummary` in @infokit/shared): every string is server-prepared
 * and localized, so this screen never formats a date or picks a translation.
 * Wiring it to the real endpoint is the next slice.
 */
const activities: Pick<
  PublicActivitySummary,
  | "id"
  | "name"
  | "shortDescription"
  | "categoryLabel"
  | "audienceLabel"
  | "placeName"
  | "status"
  | "nextOpeningLabel"
  | "lastVerifiedLabel"
>[] = [
  {
    id: "1",
    name: "Distribution de repas",
    shortDescription:
      "Repas chaud servi tous les jours, sans inscription et sans condition.",
    categoryLabel: "Repas",
    audienceLabel: "Tout le monde",
    placeName: "Place d'Armes",
    status: "open",
    nextOpeningLabel: null,
    lastVerifiedLabel: "Vérifié le 24 juillet",
  },
  {
    id: "2",
    name: "Douches et vestiaire",
    shortDescription:
      "Douches chaudes, savon fourni. Vêtements propres selon les stocks.",
    categoryLabel: "Douches",
    audienceLabel: "Hommes adultes",
    placeName: "Rue de Moscou",
    status: "closed",
    nextOpeningLabel: "Ouvre demain à 9 h 30",
    lastVerifiedLabel: "Vérifié le 22 juillet",
  },
];

const statusLabels: Record<PublicActivityStatus, string> = {
  open: "Ouvert",
  closed: "Fermé",
  cancelled: "Annulé",
  uncertain: "À confirmer",
};

export default function HomeScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "InfoKit" }} />
      <ScrollView
        className="bg-canvas flex-1"
        contentContainerClassName="gap-5 p-4 pb-10"
      >
        <View className="gap-2">
          <Text variant="eyebrow">Des informations claires au bon moment</Text>
          <Text variant="title">Trouver une aide pratique à Calais</Text>
          <Text className="text-copy-muted">
            Les activités publiées, vérifiées par des équipes locales.
          </Text>
        </View>

        <Callout tone="info" title="Confirmez avant de vous déplacer">
          Les horaires changent vite. Chaque fiche indique la date de la
          dernière vérification.
        </Callout>

        {activities.map((activity) => (
          <Card key={activity.id}>
            <View className="flex-row flex-wrap items-center gap-2">
              <StatusPill
                role={activity.status}
                label={statusLabels[activity.status]}
                detail={activity.nextOpeningLabel ?? undefined}
              />
              <Chip label={activity.categoryLabel} />
            </View>
            <CardTitle>{activity.name}</CardTitle>
            <CardDescription>{activity.shortDescription}</CardDescription>
            {/* Fixed reading order (docs/DESIGN-SYSTEM.md §1): place, then
                audience, then when it was last verified. */}
            <MetaRow label="Lieu">{activity.placeName}</MetaRow>
            <MetaRow label="Public">{activity.audienceLabel}</MetaRow>
            <Text variant="muted">{activity.lastVerifiedLabel}</Text>
          </Card>
        ))}

        <Link href="/design-system" asChild>
          <Button tone="outline">
            <Text>Voir les composants</Text>
          </Button>
        </Link>
      </ScrollView>
    </>
  );
}
