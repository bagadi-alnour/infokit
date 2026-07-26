import {
  Button,
  Callout,
  Card,
  CardTitle,
  Chip,
  Input,
  StatusPill,
  Text,
  useInfoKitTheme,
} from "@infokit/ui";
import { Stack } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";

/**
 * A living check of the native layer: if a token, a font or a NativeWind
 * utility stops resolving, it shows here before it reaches a screen.
 */
export default function DesignSystemScreen() {
  const { scheme } = useInfoKitTheme();
  const [query, setQuery] = useState("");

  return (
    <>
      <Stack.Screen options={{ title: "Composants" }} />
      <ScrollView
        className="bg-canvas flex-1"
        contentContainerClassName="gap-5 p-4 pb-10"
      >
        <View className="gap-2">
          <Text variant="eyebrow">Thème actif · {scheme}</Text>
          <Text variant="title">Système de design</Text>
        </View>

        <Card>
          <CardTitle>Statuts</CardTitle>
          <View className="flex-row flex-wrap gap-2">
            <StatusPill role="open" label="Ouvert" />
            <StatusPill role="closed" label="Fermé" detail="Ouvre à 9 h" />
            <StatusPill role="cancelled" label="Annulé" />
            <StatusPill role="uncertain" label="À confirmer" />
          </View>
        </Card>

        <Card>
          <CardTitle>Services</CardTitle>
          <View className="flex-row flex-wrap gap-2">
            <Chip label="Repas" />
            <Chip label="Eau" />
            <Chip label="Douches" />
            <Chip label="Recharge" />
          </View>
        </Card>

        <Card>
          <CardTitle>Actions</CardTitle>
          <Button>
            <Text>Action principale</Text>
          </Button>
          <Button tone="outline">
            <Text>Action secondaire</Text>
          </Button>
          <Button tone="quiet">
            <Text>Action discrète</Text>
          </Button>
        </Card>

        <Card>
          <CardTitle>Saisie</CardTitle>
          <Input
            label="Rechercher une activité"
            hint="Trois lettres suffisent."
            value={query}
            onChangeText={setQuery}
            placeholder="Repas, douches…"
          />
        </Card>

        <Callout tone="warning" title="Information à confirmer">
          Cette fiche n’a pas été vérifiée récemment.
        </Callout>
        <Callout tone="danger" title="Activité annulée">
          La distribution de ce soir n’a pas lieu.
        </Callout>
        <Callout tone="success" title="Vérifié aujourd’hui">
          Les horaires ont été confirmés par l’association.
        </Callout>
      </ScrollView>
    </>
  );
}
