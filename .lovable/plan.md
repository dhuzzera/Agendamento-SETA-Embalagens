## Nova regra: agendamento presencial por região

Implementar restrição de região para reuniões presenciais com bloqueio automático de deslocamento entre visitas.

### 1. Banco de dados (migração)

**Tabela `appointments`** — adicionar:
- `city` (text, nullable) — cidade da visita presencial
- `state` (text, nullable) — UF (2 letras)

(`location` já existe para o endereço; `meeting_type` já existe.)

**Tabela `app_settings`** (nova, singleton) — configurações globais editáveis pelo admin:
- `id` (smallint PK fixo = 1)
- `travel_buffer_minutes` (int, default 90)
- RLS: leitura para todos autenticados; update apenas admin.
- Seed da linha id=1.

**Função `validate_appointment` (atualizar)**:
- Se `meeting_type = 'presencial'`:
  - Exigir `city`, `state`, `location` não nulos.
  - Verificar se já existe outro presencial confirmado (`scheduled`/`rescheduled`) para o mesmo `representative_id` na mesma `appointment_date`:
    - Se sim → exigir mesma `city` + `state` (case-insensitive trim). Caso contrário, erro: `"Agenda de DD/MM bloqueada para CIDADE - UF"`.
  - Verificar buffer de deslocamento: nenhum outro presencial do mesmo rep no mesmo dia pode estar dentro de `[start - buffer, end + buffer]` (buffer = `travel_buffer_minutes` de `app_settings`). Se conflitar → erro com horário sugerido.
- Conflito normal de horário (online vs online, online vs presencial fora do buffer) continua valendo via lógica atual de overlap.

### 2. Backend / lógica de slots

**`PublicBooking.tsx`** (cliente público agenda):
- Campos novos no formulário quando `meeting_type = presencial`: `cidade`, `estado` (Select UF), `endereço` (já existe).
- Ao calcular slots disponíveis para uma data:
  - Carregar `app_settings.travel_buffer_minutes`.
  - Buscar appointments do dia (status scheduled/rescheduled) — já fazemos.
  - Se algum presencial já existir no dia: capturar `region_city/state` do primeiro.
    - Se cliente escolheu presencial e cidade/estado ≠ região definida → desabilitar todos os slots do dia com aviso "Dia 20/05 reservado para Joinville - SC".
    - Se cidade/estado = região: remover slots dentro de `[apt.start - buffer, apt.end + buffer]` para presencial.
  - Para online: lógica atual sem buffer extra (apenas overlap simples).
- Mostrar campos `cidade`/`estado` antes de selecionar a data quando presencial, para filtrar corretamente.

### 3. Dashboard do representante (`RepDashboard.tsx`)

- Card novo "Agenda por região" mostrando próximos 14 dias com presenciais:
  - Para cada dia com presencial: `"DD/MM — Cidade - UF (N visitas)"` com badge "Bloqueado para esta região".
- Tooltip explicando regra dos 3h.

### 4. Lista de agendamentos / admin

**`AppointmentsList.tsx`** (admin):
- Adicionar filtro por `cidade` (input texto) e mostrar coluna cidade/UF nas linhas presenciais.
- Filtro `meeting_type` já existe (manter).

**`AdminDashboard.tsx`**:
- Card "Agenda por cidade do dia" listando representantes × data × cidade-base.

### 5. Configuração admin

Em `UserManagement.tsx` ou nova aba simples em `/admin`: input "Tempo de deslocamento padrão (minutos)" lendo/gravando `app_settings`. Default 180.

### 6. Detalhes do agendamento

`AppointmentDetailsDialog.tsx`: exibir `city/state` quando presencial. Admin pode editar.

### Arquivos afetados (técnico)

- `supabase/migrations/<timestamp>_region_rule.sql` (novo)
- `src/features/public/PublicBooking.tsx`
- `src/features/representative/RepDashboard.tsx`
- `src/features/representative/AppointmentsList.tsx`
- `src/features/admin/AdminDashboard.tsx`
- `src/features/admin/AppointmentDetailsDialog.tsx`
- nova UI de config: provavelmente em `src/routes/_app/admin.tsx` (card "Configurações gerais")
- types regenerados automaticamente após migração

### Premissas

- "Cidade/região" = par `(city, state)` normalizado (lowercase + trim) para comparação. Sem geocoding.
- Buffer aplicado apenas entre presenciais (online não consome buffer e não é bloqueado por buffer).
- Validação de "primeiro presencial define a região" é feita no banco (trigger) — fonte da verdade — e replicada no front para feedback imediato.
- Admin ao editar pode mover/cancelar livremente, mas a trigger continua validando.
