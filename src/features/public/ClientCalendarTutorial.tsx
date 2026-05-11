import { Apple, CalendarPlus, Download, ExternalLink, Mail, Smartphone } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CalendarEvent } from "@/lib/calendar";
import { cn } from "@/lib/utils";

type CalendarLib = typeof import("@/lib/calendar");

type Props = {
  calendarEvent: CalendarEvent;
  fileName: string;
  calendarLib: CalendarLib | null;
  googleUrl: string;
};

/**
 * Tutorial passo-a-passo para o cliente adicionar a reunião na própria
 * agenda. Espelha a experiência usada pelo representante (iPhone / Android /
 * Outlook), mas para um único evento (em vez de uma assinatura de feed).
 */
export function ClientCalendarTutorial({
  calendarEvent,
  fileName,
  calendarLib,
  googleUrl,
}: Props) {
  const downloadIcs = () => {
    calendarLib?.downloadIcsFile(calendarEvent, fileName);
  };

  // Deep link do Outlook web (Outlook.com) para compor um evento já preenchido.
  const outlookUrl = (() => {
    const startIso = `${calendarEvent.date}T${calendarEvent.startTime}`;
    const endIso = `${calendarEvent.date}T${calendarEvent.endTime}`;
    const params = new URLSearchParams({
      path: "/calendar/action/compose",
      rru: "addevent",
      subject: calendarEvent.title,
      startdt: startIso,
      enddt: endIso,
      body: calendarEvent.description ?? "",
    });
    return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
  })();

  const disabled = !calendarLib;

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        Adicionar à sua agenda
      </p>
      <p className="text-sm text-muted-foreground">
        Escolha onde você quer salvar este compromisso e siga o passo-a-passo.
      </p>

      <Tabs defaultValue="iphone" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="iphone" className="gap-1.5">
            <Apple className="h-3.5 w-3.5" />
            iPhone
          </TabsTrigger>
          <TabsTrigger value="android" className="gap-1.5">
            <Smartphone className="h-3.5 w-3.5" />
            Android
          </TabsTrigger>
          <TabsTrigger value="outlook" className="gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            Outlook
          </TabsTrigger>
        </TabsList>

        {/* iPhone / Apple — usa o arquivo .ics */}
        <TabsContent value="iphone" className="mt-4 space-y-3">
          <button
            type="button"
            onClick={downloadIcs}
            disabled={disabled}
            className={cn(
              "inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary-hover disabled:opacity-60 sm:w-auto",
            )}
          >
            <Apple className="h-4 w-4" />
            Adicionar ao Apple Calendar
            <Download className="ml-0.5 h-3.5 w-3.5 opacity-80" />
          </button>
          <ol className="space-y-1.5 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">1.</span> Toque no
              botão azul acima no seu iPhone.
            </li>
            <li>
              <span className="font-medium text-foreground">2.</span> O iPhone
              vai abrir o app Calendário com o evento preenchido — toque em{" "}
              <span className="font-medium text-foreground">Adicionar</span>.
            </li>
            <li>
              <span className="font-medium text-foreground">3.</span> Pronto!
              A reunião fica salva no seu calendário com lembrete.
            </li>
          </ol>
        </TabsContent>

        {/* Android / Google */}
        <TabsContent value="android" className="mt-4 space-y-3">
          <a
            href={disabled ? "#" : googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={disabled}
            onClick={(e) => {
              if (disabled) e.preventDefault();
            }}
            className={cn(
              "inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary-hover sm:w-auto",
              disabled && "pointer-events-none opacity-60",
            )}
          >
            <CalendarPlus className="h-4 w-4" />
            Adicionar ao Google Calendar
            <ExternalLink className="ml-0.5 h-3.5 w-3.5 opacity-80" />
          </a>
          <ol className="space-y-1.5 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">1.</span> Toque no
              botão acima — vai abrir o Google Agenda com o evento preenchido.
            </li>
            <li>
              <span className="font-medium text-foreground">2.</span> Confira
              os horários e toque em{" "}
              <span className="font-medium text-foreground">Salvar</span>.
            </li>
            <li>
              <span className="font-medium text-foreground">3.</span> Pelo
              celular Android, o compromisso aparece automaticamente no app
              Google Agenda.
            </li>
          </ol>
        </TabsContent>

        {/* Outlook */}
        <TabsContent value="outlook" className="mt-4 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href={outlookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary-hover"
            >
              <Mail className="h-4 w-4" />
              Outlook.com
              <ExternalLink className="ml-0.5 h-3.5 w-3.5 opacity-80" />
            </a>
            <button
              type="button"
              onClick={downloadIcs}
              disabled={disabled}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border-2 border-primary bg-background px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              Baixar .ics
            </button>
          </div>
          <ol className="space-y-1.5 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">1.</span> Se você
              usa <span className="font-medium text-foreground">Outlook.com</span>
              , clique no botão azul — o evento abre já preenchido na sua
              agenda. Confirme em{" "}
              <span className="font-medium text-foreground">Salvar</span>.
            </li>
            <li>
              <span className="font-medium text-foreground">2.</span> Se usa o{" "}
              <span className="font-medium text-foreground">
                Outlook do trabalho
              </span>{" "}
              (desktop), clique em{" "}
              <span className="font-medium text-foreground">Baixar .ics</span> e
              abra o arquivo — o Outlook vai propor adicionar o compromisso.
            </li>
            <li>
              <span className="font-medium text-foreground">3.</span> Confira os
              horários e clique em{" "}
              <span className="font-medium text-foreground">Salvar e fechar</span>
              .
            </li>
          </ol>
        </TabsContent>
      </Tabs>
    </div>
  );
}
