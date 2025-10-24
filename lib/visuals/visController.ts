import { subscribe, AppEvent } from "@/lib/eventBus";
import { cyclePalette, bumpIntensity } from "@/lib/state";

let isRegistered = false;

export function registerVisHandlers() {
  if (isRegistered) return;
  isRegistered = true;

  subscribe((event: AppEvent) => {
    switch (event.type) {
      case "vis.burst":
        cyclePalette(+1);
        bumpIntensity(0.6);
        break;
      case "vis.pulse":
        bumpIntensity(event.payload?.amount ?? 0.4);
        break;
    }
  });
}
