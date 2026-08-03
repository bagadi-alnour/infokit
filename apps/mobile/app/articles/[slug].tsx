import { brandName } from "@infokit/shared/i18n";
import { Callout, Card, MetaRow, Text } from "@infokit/ui";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { View } from "react-native";

import { CoverImage } from "~/components/content-parts";
import { PayloadScreen } from "~/components/payload-screen";
import { publicClient } from "~/lib/client";
import { usePreferences } from "~/lib/preferences";
import { usePublicPayload } from "~/lib/use-public-payload";

/**
 * Editorial bodies are stored as plain text, so paragraphs are the only
 * structure there is to trust — the same split the web reader does, and for the
 * same reason: no markup from authored content is ever interpreted.
 */
function paragraphs(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);
}

/** One article, read top to bottom. */
export default function ArticleScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { locale, strings } = usePreferences();
  const load = useCallback(
    (signal: AbortSignal) => publicClient.getArticle(slug, { locale, signal }),
    [slug, locale],
  );
  const request = usePublicPayload(load);
  const title =
    request.state.status === "ready"
      ? request.state.payload?.article.title
      : undefined;

  return (
    <>
      <Stack.Screen options={{ title: title ?? brandName(locale) }} />
      <PayloadScreen request={request} strings={strings}>
        {({ article, labels }) => (
          <>
            <CoverImage
              image={article.coverImage}
              className="rounded-card h-44"
            />

            {article.unreliable ? (
              <Callout tone="warning" title={labels.unreliable}>
                {article.unreliableFromLabel}
              </Callout>
            ) : null}

            <View className="gap-2">
              <Text variant="title">{article.title}</Text>
              {/* The same plum rule the article card carries, so the piece is
                  recognisably the thing that was tapped. */}
              <View className="bg-article h-0.5 w-10 self-start rounded-full" />
              <Text className="text-copy-muted">{article.summary}</Text>
            </View>

            {article.fallbackUsed ? (
              <Callout tone="info">{article.fallbackLabel}</Callout>
            ) : null}

            <Text variant="muted">{article.articleDateLabel}</Text>

            <View className="gap-4">
              {paragraphs(article.body).map((paragraph, index) => (
                <Text key={index}>{paragraph}</Text>
              ))}
            </View>

            {/* Who wrote it and when it was last checked sit after the text: a
                reader judges what to do with it once they have read it
                (docs/DESIGN-SYSTEM.md §2). */}
            <Card>
              {article.ownerNames.length > 0 ? (
                <MetaRow label={labels.publishedBy}>
                  {article.ownerNames.join(" · ")}
                </MetaRow>
              ) : null}
              <MetaRow label={labels.lastReviewed}>
                {article.lastReviewedLabel}
              </MetaRow>
            </Card>
          </>
        )}
      </PayloadScreen>
    </>
  );
}
