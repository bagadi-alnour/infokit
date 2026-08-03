import type { PageCatalog } from "@infokit/shared/i18n/catalogs";

export interface ListenControlLabels {
  title: string;
  description: string;
  play: string;
  pause: string;
  resume: string;
  loading: string;
  error: string;
  retry: string;
  progress: string;
  speed: string;
  aiDisclosure: string;
}

export function listenControlLabels(
  messages: PageCatalog<"public-content">,
): ListenControlLabels {
  return {
    title: messages["listen.title"],
    description: messages["listen.description"],
    play: messages["listen.play"],
    pause: messages["listen.pause"],
    resume: messages["listen.resume"],
    loading: messages["listen.loading"],
    error: messages["listen.error"],
    retry: messages["listen.retry"],
    progress: messages["listen.progress"],
    speed: messages["listen.speed"],
    aiDisclosure: messages["listen.aiDisclosure"],
  };
}
