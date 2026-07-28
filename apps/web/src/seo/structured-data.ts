import type { PublicLocale } from "@infokit/shared/i18n";
import type {
  Article,
  BreadcrumbList,
  Event as EventSchema,
  ItemList,
  NGO,
  Organization,
  Service,
  Thing,
  WebSite,
  WithContext,
} from "schema-dts";

import { localizedPath } from "~/i18n/routing";
import { absoluteUrl, siteConfig } from "~/seo/site";
import type { LocationPrecision } from "~/server/content/coordination-events";
import type { PublishedActivity } from "~/server/content/public-content";

/**
 * Machine-readable descriptions of what each public page is about.
 *
 * These exist for two readers that never see the rendered page: search engines
 * building rich results, and the answering agents that increasingly quote this
 * kind of information back to someone who asked a question. Both need the same
 * things the page shows a person — who provides this, where, when, and how
 * fresh it is — which is why every builder here reads the public read model
 * rather than re-deriving anything.
 *
 * `schema-dts` types these against schema.org, so a misnamed property or a
 * value in the wrong shape fails typecheck instead of shipping as invalid
 * structured data nobody notices.
 */

/** ISO 8601 weekday (Mon=1 … Sun=7), as the schedule rules store it. */
const SCHEMA_WEEKDAYS = [
  "https://schema.org/Monday",
  "https://schema.org/Tuesday",
  "https://schema.org/Wednesday",
  "https://schema.org/Thursday",
  "https://schema.org/Friday",
  "https://schema.org/Saturday",
  "https://schema.org/Sunday",
] as const;

/**
 * The platform as an entity, for pages to name as their publisher. Returned
 * without `@context` because it is always nested inside another node.
 */
export function publisher(): Organization {
  return {
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url.origin,
  };
}

/** The site itself, on the home page. */
export function websiteJsonLd({
  locale,
  description,
}: {
  locale: PublicLocale;
  description: string;
}): WithContext<WebSite> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    description,
    url: absoluteUrl(localizedPath("/", locale)),
    inLanguage: locale,
    publisher: publisher(),
  };
}

/**
 * One published activity: a service somebody can go and use.
 *
 * Modelled as `Service` rather than `LocalBusiness` because these are meals,
 * showers, clinics and advice sessions offered by associations — not businesses
 * — and the provider is named separately from the place it happens in.
 *
 * The address and coordinates are emitted only when the read model supplied
 * them, which it does exclusively for places approved for exact public display
 * (RISKS.md R5). An area-only place therefore contributes a name and nothing a
 * crawler could turn into a pin.
 */
export function activityJsonLd({
  activity,
  locale,
}: {
  activity: PublishedActivity;
  locale: PublicLocale;
}): WithContext<Service> {
  const url = absoluteUrl(
    localizedPath(`/activities/${activity.slug}`, locale),
  );
  const providers = activity.providers.map<Organization>((provider) => ({
    "@type": "Organization",
    name: provider.name,
    url: absoluteUrl(localizedPath(`/organizations/${provider.slug}`, locale)),
  }));

  const hasExactLocation = Boolean(activity.address);
  const place = activity.placeName || activity.address;

  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: activity.name,
    description: activity.shortDescription || activity.description,
    url,
    // Deliberately no language property: schema.org would read it as the
    // language the service is *delivered* in, and what the read model knows is
    // only which language this description was written in. Claiming a team
    // speaks Tigrinya because the entry was translated into it would send
    // someone to a door where nobody can help them.
    ...(activity.categoryLabel ? { serviceType: activity.categoryLabel } : {}),
    ...(providers.length > 0 ? { provider: providers } : {}),
    ...(activity.audienceLabel
      ? {
          audience: {
            "@type": "Audience",
            audienceType: activity.audienceLabel,
          },
        }
      : {}),
    ...(activity.services.length > 0
      ? {
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: activity.categoryLabel || activity.name,
            itemListElement: activity.services.map((service) => ({
              "@type": "Offer",
              itemOffered: { "@type": "Service", name: service.label },
              // Nothing published here is sold.
              price: "0",
              priceCurrency: "EUR",
            })),
          },
        }
      : {}),
    ...(place
      ? {
          areaServed: {
            "@type": "Place",
            name: place,
            ...(hasExactLocation
              ? {
                  address: {
                    "@type": "PostalAddress",
                    streetAddress: activity.address,
                    addressCountry: "FR",
                  },
                }
              : {}),
            ...(activity.latitude !== null && activity.longitude !== null
              ? {
                  geo: {
                    "@type": "GeoCoordinates",
                    latitude: activity.latitude,
                    longitude: activity.longitude,
                  },
                }
              : {}),
          },
        }
      : {}),
    ...(activity.schedules.length > 0
      ? {
          hoursAvailable: activity.schedules.map((schedule) => ({
            "@type": "OpeningHoursSpecification" as const,
            dayOfWeek: SCHEMA_WEEKDAYS[schedule.weekday - 1],
            opens: schedule.startTime.slice(0, 5),
            closes: schedule.endTime.slice(0, 5),
          })),
        }
      : {}),
    ...(activity.coverImage
      ? { image: absoluteUrl(activity.coverImage.url) }
      : {}),
  };
}

/** One dated, reviewed read. */
export function articleJsonLd({
  locale,
  slug,
  title,
  description,
  publishedAt,
  modifiedAt,
  authors,
  image,
  inLanguage,
}: {
  locale: PublicLocale;
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  modifiedAt?: string;
  authors: string[];
  image?: string | null;
  inLanguage: string;
}): WithContext<Article> {
  const url = absoluteUrl(localizedPath(`/articles/${slug}`, locale));
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    datePublished: publishedAt,
    ...(modifiedAt ? { dateModified: modifiedAt } : {}),
    inLanguage,
    // The factual owner of the claim, which is the association that published
    // it — not the platform that hosts it.
    author:
      authors.length > 0
        ? authors.map<Organization>((name) => ({
            "@type": "Organization",
            name,
          }))
        : publisher(),
    publisher: publisher(),
    ...(image ? { image: absoluteUrl(image) } : {}),
  };
}

/**
 * One public event on the agenda.
 *
 * Unlike an activity, a coordination event's record carries its address
 * whatever the place's precision — so the precision is gated here rather than
 * at the call site. A `contact_to_learn` place contributes no location node at
 * all, and an area-only place contributes a name without a street (RISKS.md
 * R5). Passing the raw precision rather than a pre-decided address is what
 * makes that impossible to forget.
 */
export function eventJsonLd({
  locale,
  id,
  name,
  description,
  startsAt,
  endsAt,
  cancelled,
  hostName,
  placeName,
  address,
  precision,
  image,
}: {
  locale: PublicLocale;
  id: string;
  name: string;
  description?: string | null;
  startsAt: Date;
  endsAt: Date;
  cancelled: boolean;
  hostName?: string | null;
  placeName?: string | null;
  address?: string | null;
  precision: LocationPrecision | null;
  image?: string | null;
}): WithContext<EventSchema> {
  const withheld = precision === "contact_to_learn";
  const location = withheld ? null : placeName;
  const street = precision === "exact" ? address : null;
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name,
    ...(description ? { description } : {}),
    url: absoluteUrl(localizedPath(`/events/${id}`, locale)),
    startDate: startsAt.toISOString(),
    endDate: endsAt.toISOString(),
    eventStatus: cancelled
      ? "https://schema.org/EventCancelled"
      : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    ...(hostName
      ? { organizer: { "@type": "Organization", name: hostName } }
      : {}),
    ...(location
      ? {
          location: {
            "@type": "Place",
            name: location,
            ...(street
              ? {
                  address: {
                    "@type": "PostalAddress",
                    streetAddress: street,
                    addressCountry: "FR",
                  },
                }
              : {}),
          },
        }
      : {}),
    ...(image ? { image: absoluteUrl(image) } : {}),
  };
}

/**
 * One association's public profile. Typed `NGO` rather than plain
 * `Organization`: it is the accurate narrowing, and it tells an agent that this
 * is a non-profit provider rather than a company selling something.
 */
export function organizationJsonLd({
  locale,
  slug,
  name,
  description,
  website,
  foundedYear,
}: {
  locale: PublicLocale;
  slug: string;
  name: string;
  description: string;
  website?: string | null;
  foundedYear?: number | null;
}): WithContext<NGO> {
  return {
    "@context": "https://schema.org",
    "@type": "NGO",
    name,
    description,
    url: absoluteUrl(localizedPath(`/organizations/${slug}`, locale)),
    ...(website ? { sameAs: website } : {}),
    ...(foundedYear ? { foundingDate: String(foundedYear) } : {}),
  };
}

/**
 * Where this page sits, so a result can show a path rather than a bare URL.
 * The trail excludes the current page's own name only when it is the root.
 */
export function breadcrumbJsonLd({
  locale,
  trail,
}: {
  locale: PublicLocale;
  trail: Array<{ name: string; path: string }>;
}): WithContext<BreadcrumbList> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((step, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: step.name,
      item: absoluteUrl(localizedPath(step.path, locale)),
    })),
  };
}

/**
 * What a collection page lists, in the order a reader sees it. Gives an agent
 * the set of things on the page without it having to parse the markup.
 */
export function collectionJsonLd({
  locale,
  name,
  description,
  items,
}: {
  locale: PublicLocale;
  name: string;
  description: string;
  items: Array<{ name: string; path: string }>;
}): WithContext<ItemList> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    description,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: absoluteUrl(localizedPath(item.path, locale)),
    })),
  };
}

export type StructuredData = WithContext<Thing>;
