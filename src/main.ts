import { provideZonelessChangeDetection } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { AppComponent } from "./app/ui/app.js";
bootstrapApplication(AppComponent, {
  providers: [provideZonelessChangeDetection()],
}).catch((error: unknown) => {
  console.error(error);
  const root = document.querySelector("ww-app");
  if (root)
    root.textContent =
      "Não foi possível iniciar Choravia. Recarregue para tentar novamente.";
});
