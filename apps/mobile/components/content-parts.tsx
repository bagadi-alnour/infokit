import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type {
  PublicContentImage,
  PublicTransitLink,
} from "@infokit/shared/public-content";
import { cn, Text, useInfoKitTheme } from "@infokit/ui";
import { useRouter } from "expo-router";
import { Image, Pressable, View } from "react-native";

import { ForwardChevron } from "~/components/forward-chevron";
import { TaxonomyIcon } from "~/components/taxonomy-icon";
import { publicClient } from "~/lib/client";
import { hrefSlug } from "~/lib/href-slug";
import { openMap, type MapTarget } from "~/lib/open-map";

/**
 * The parts of a card or a detail screen that behave the same wherever the
 * content came from: its picture, the association behind it, and its address.
 */

/**
 * The picture on a card or a page, when the editor attached one.
 *
 * A photograph never carries information (docs/DESIGN-SYSTEM.md §7): the card
 * says everything without it, so a missing or slow image costs a reader nothing
 * — and a decorative one says nothing a screen reader needs to hear.
 */
export function CoverImage({
  image,
  className,
}: {
  image: PublicContentImage | null;
  className?: string;
}) {
  if (!image) return null;

  return (
    <Image
      source={{ uri: publicClient.resolveUrl(image.url) }}
      className={cn(
        "rounded-control bg-subtle border-line h-36 w-full border",
        className,
      )}
      resizeMode="cover"
      accessible={!image.decorative}
      accessibilityLabel={image.decorative ? undefined : image.alt}
    />
  );
}

/**
 * The association behind an activity or an event, as a link to its own screen.
 *
 * "Who runs this" is one of the four questions the first screen must answer
 * (docs/DESIGN-SYSTEM.md §1), and the answer is only useful if a reader can go
 * and read who they are. That page is now the app's own, so the row stays inside
 * the app: a name pressed on a card leads onward, never out to a browser the
 * reader then has to find their way back from.
 */
export function OrganisationLink({
  name,
  href,
  label,
}: {
  name: string;
  href: string;
  label?: string;
}) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label ? `${label}: ${name}` : name}
      onPress={() => {
        router.push({
          pathname: "/organizations/[slug]",
          params: { slug: hrefSlug(href) },
        });
      }}
      className="min-h-touch active:bg-subtle rounded-control -mx-1 flex-row items-center gap-2 px-1 py-2"
    >
      <TaxonomyIcon name="users" size={18} />
      <View className="flex-1 gap-0.5">
        {label ? <Text variant="eyebrow">{label}</Text> : null}
        <Text className="text-brand-deep font-semibold underline">{name}</Text>
      </View>
      <ForwardChevron size={18} tone="brand" />
    </Pressable>
  );
}

/**
 * The address, as the thing you press to be walked there.
 *
 * On the street the address is not a caption, it is the next step: pressing it
 * hands the words to the phone's map application (`openMap`), which is Google
 * Maps wherever the phone has it. Nothing about the reader's own position is
 * ever asked for or sent.
 */
export function AddressLink({
  label,
  placeName,
  address,
  target,
  actionLabel,
}: {
  label?: string;
  placeName?: string;
  address?: string;
  target: MapTarget;
  actionLabel: string;
}) {
  const { tokens } = useInfoKitTheme();

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${actionLabel}: ${[placeName, address].filter(Boolean).join(", ")}`}
      onPress={() => {
        void openMap(target);
      }}
      className="min-h-touch active:bg-subtle rounded-control -mx-1 flex-row items-start gap-2 px-1 py-2"
    >
      <View className="pt-0.5">
        <TaxonomyIcon name="map-pin" size={18} />
      </View>
      <View className="flex-1 gap-0.5">
        {label ? <Text variant="eyebrow">{label}</Text> : null}
        {placeName ? <Text className="font-semibold">{placeName}</Text> : null}
        {address ? <Text className="text-copy-muted">{address}</Text> : null}
        <Text className="text-brand-deep font-semibold underline">
          {actionLabel}
        </Text>
      </View>
      <View className="pt-0.5">
        <Feather name="external-link" size={16} color={tokens.accentDeep} />
      </View>
    </Pressable>
  );
}

/**
 * A glyph per mode of transport, keyed by the stored mode rather than by the
 * translated word: a catalogue in Pashto must not change which picture is drawn.
 * The web reader draws the same eight (apps/web/src/components/public/transit-links.tsx).
 */
const transitGlyphs: Record<
  PublicTransitLink["mode"],
  keyof typeof MaterialCommunityIcons.glyphMap
> = {
  bus: "bus",
  tram: "tram",
  metro: "subway-variant",
  train: "train",
  coach: "bus-side",
  ferry: "ferry",
  bike: "bike",
  other: "map-marker-path",
};

/**
 * How to reach an activity or an event without a car, one line per way in.
 *
 * The mode and its line lead, because that is what a reader matches against the
 * front of a bus; the stop keeps the network's own spelling, so it can be read
 * out to a driver; the walk is last and quiet. Every word arrived translated and
 * every number in the reader's own digits — this only draws them.
 *
 * Not pressable: a bus line is not a place a maps application can be handed, and
 * the address above it already is (`AddressLink`).
 */
export function TransitLinks({ links }: { links: PublicTransitLink[] }) {
  if (links.length === 0) return null;

  return (
    <View className="gap-2">
      {links.map((link, index) => (
        <View
          // Two identical rows are one journey written twice, which an editor
          // may well keep; the position is what tells them apart.
          key={`${String(index)}-${link.mode}-${link.line ?? ""}-${link.stopName ?? ""}`}
          className="flex-row items-start gap-2"
          accessible
          accessibilityLabel={link.label}
        >
          <View className="pt-0.5">
            <TransitGlyph mode={link.mode} />
          </View>
          <Text className="flex-1">
            <Text className="font-semibold">
              {link.line === null
                ? link.modeLabel
                : `${link.modeLabel} ${link.line}`}
            </Text>
            {link.stopName === null ? null : ` · ${link.stopName}`}
            {link.walkLabel === null ? null : (
              <Text className="text-copy-muted"> · {link.walkLabel}</Text>
            )}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** The mode's picture, in the accent every card icon wears (§5). */
function TransitGlyph({ mode }: { mode: PublicTransitLink["mode"] }) {
  const { tokens } = useInfoKitTheme();

  return (
    <MaterialCommunityIcons
      name={transitGlyphs[mode]}
      size={18}
      color={tokens.accentDeep}
    />
  );
}
