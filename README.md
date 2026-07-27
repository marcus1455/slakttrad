# Släktträd

Webbapp för Sofias familj. Data ligger i Supabase; layouten räknas ut automatiskt.

## Köra lokalt

1. Kopiera `.env.example` till `.env` och fyll i:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
2. Installera och starta:

```bash
npm install
npm run dev
```

## Data

Tabellen `family_trees` (slug `davidsson`) lagrar `root_id`, `profiles`, `nodes` och `share_token`.

## URL:er

- **Nytt träd:** `/` skapar en tom board och öppnar den
- **Davidsson:** `/trad/davidsson`
- **Dela (endast visning):** `/dela/<share_token>`

I redigeringsläget: delningsikonen öppnar modal för att kopiera/visa-länk. **Skapa ny länk** byter token så den gamla slutar fungera.
