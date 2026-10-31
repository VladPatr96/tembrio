import { type ReactNode } from "react";
import {
  Badge,
  Button,
  Chip,
  Chips,
  Icon,
  IconButton,
  Karaoke,
  Kbd,
  Progress,
  Switch,
  Tag,
  TrayIcon,
  type TrayState,
  VoicePortrait,
  Wordmark,
} from "@/design";

/*
 * Shelves 11–17: the parts of the v5 prototype the design-system shelves
 * (1–10) do not cover — the speech pill in every state, the tray icon, list
 * rows, voice cards, the pronunciation playground, onboarding steps and the
 * tray panel with its menu. Everything here is a static photograph of the
 * real component: the same classes, the same markup shape. When a stage
 * rebuilds a live screen, its kit shelf only changes if the component did.
 */

export type ShelfDef = {
  n: number;
  title: string;
  lead: string;
  body: ReactNode;
};

const SAMPLE =
  "До шестнадцатого октября две тысячи двадцать шестого года сумма".split(" ");

/* ── pill ───────────────────────────────────────────────────── */

function Pill({
  children,
  speaking = false,
  withProgress = false,
  progress = 0.4,
}: {
  children: ReactNode;
  speaking?: boolean;
  withProgress?: boolean;
  progress?: number;
}) {
  return (
    <span
      style={{ display: "inline-flex", flexDirection: "column", flex: "none" }}
    >
      <span
        className={`tb-pill ${speaking ? "tb-speak" : ""}`}
        style={{ position: "relative", left: "auto", bottom: "auto" }}
      >
        {children}
        {withProgress ? (
          <span className="tb-pprog" aria-hidden>
            <i style={{ width: `${Math.round(progress * 100)}%` }} />
          </span>
        ) : null}
      </span>
    </span>
  );
}

const KARA_WORDS_MACHINE = "до шестнадцатого октября суммы".split(" ");
const LEVELS = [0.2, 0.5, 0.9, 0.6, 0.3, 0.7, 0.4, 0.15, 0.5];

function pillShelf(): ReactNode {
  return (
    <div className="kp-board kp-c2">
      <div className="kp-cell">
        <div className="kp-cap">короткая запись</div>
        <div
          className="kp-demo"
          style={{ flexDirection: "column", alignItems: "flex-start", gap: 12 }}
        >
          <Pill>
            <span className="tb-rdot" aria-hidden />
            <span
              style={{ display: "inline-flex" }}
              className="tb-level tb-live"
            >
              {LEVELS.map((l, i) => (
                <i key={i} style={{ height: `${Math.round(20 + l * 80)}%` }} />
              ))}
            </span>
            <button type="button" className="tb-pbt" aria-label="Отменить">
              <Icon name="x" />
            </button>
          </Pill>
          <Pill>
            <span className="tb-shim">Распознаю…</span>
          </Pill>
          <Pill>
            <span className="tb-okicon" aria-hidden>
              <Icon name="check" />
            </span>
            <span>Вставлено</span>
          </Pill>
        </div>
      </div>
      <div className="kp-cell">
        <div className="kp-cap">озвучка</div>
        <div
          className="kp-demo"
          style={{ flexDirection: "column", alignItems: "flex-start", gap: 12 }}
        >
          <Pill>
            <span className="tb-spinner" aria-hidden />
            <span className="tb-mut">Готовлю голос Achird…</span>
          </Pill>
          <Pill speaking withProgress progress={0.42}>
            <span className="tb-pvoice">Денис</span>
            <Karaoke
              words={KARA_WORDS_MACHINE}
              current={2}
              className="pill-kara"
            />
            <button type="button" className="tb-pbt" aria-label="Пауза">
              <Icon name="pause" />
            </button>
            <button type="button" className="tb-pbt" aria-label="Стоп">
              <Icon name="stop" />
            </button>
          </Pill>
          <Pill>
            <span className="tb-pvoice">Денис</span>
            <Karaoke words={KARA_WORDS_MACHINE} current={1} />
            <button type="button" className="tb-pbt" aria-label="Продолжить">
              <Icon name="play" />
            </button>
            <button type="button" className="tb-pbt" aria-label="Стоп">
              <Icon name="stop" />
            </button>
            <span style={{ fontSize: 11.5, color: "#A9A3B5", flex: "none" }}>
              пауза
            </span>
          </Pill>
        </div>
      </div>
      <div className="kp-cell" style={{ gridColumn: "1 / -1" }}>
        <div className="kp-cap">сообщения с действием</div>
        <div
          className="kp-demo"
          style={{ flexDirection: "column", alignItems: "flex-start", gap: 12 }}
        >
          <Pill>
            <span className="tb-wicon tb-err" aria-hidden>
              !
            </span>
            <span>Нет ключа OpenRouter</span>
            <button type="button" className="tb-pact">
              Добавить
            </button>
          </Pill>
          <Pill>
            <span className="tb-wicon tb-warn" aria-hidden>
              !
            </span>
            <span>Закончились деньги</span>
            <button type="button" className="tb-pact">
              Пополнить
            </button>
          </Pill>
          <Pill>
            <span className="tb-wicon tb-warn" aria-hidden>
              !
            </span>
            <span>Нет сети — других голосов не скачано</span>
          </Pill>
          <Pill>
            <span className="tb-wicon tb-warn" aria-hidden>
              !
            </span>
            <span>Ничего не выделено</span>
          </Pill>
        </div>
      </div>
    </div>
  );
}

/* ── tray icon ──────────────────────────────────────────────── */

const TRAY_STATES: { state: TrayState; label: string }[] = [
  { state: "idle", label: "покой" },
  { state: "recording", label: "запись" },
  { state: "speaking", label: "читает" },
  { state: "transcribing", label: "распознаёт" },
  { state: "warn", label: "нужна помощь" },
];

function trayShelf(): ReactNode {
  return (
    <div className="kp-board kp-c2">
      <div className="kp-cell">
        <div className="kp-cap">светлая панель</div>
        <span className="tb-trayset tb-trayset-light">
          {TRAY_STATES.map((s) => (
            <span key={s.state} className="tb-trayslot" title={s.label}>
              <TrayIcon state={s.state} tone="on-light" />
              <span className="kp-cap tb-trayslot-cap">{s.label}</span>
            </span>
          ))}
        </span>
      </div>
      <div className="kp-cell">
        <div className="kp-cap">тёмная панель</div>
        <span className="tb-trayset tb-trayset-dark">
          {TRAY_STATES.map((s) => (
            <span key={s.state} className="tb-trayslot" title={s.label}>
              <TrayIcon state={s.state} tone="on-dark" />
              <span className="kp-cap tb-trayslot-cap">{s.label}</span>
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

/* ── list rows (history, models, downloads) ─────────────────── */

function rowsShelf(): ReactNode {
  return (
    <div className="kp-board kp-c2">
      <div className="kp-cell">
        <div className="kp-cap">история</div>
        <div className="kp-demo kp-col">
          <div className="tb-hgroup">Сегодня</div>
          <div className="tb-hrow">
            <span className="tb-hk">
              <Icon name="speak-selection" />
            </span>
            <div className="tb-hb">
              <p>
                «Выделите текст в любой программе — Tembrio прочитает его
                выбранным голосом, с паузой по Ctrl+Alt+P.»
              </p>
              <div className="tb-hm">Денис · $0.0004 · 12:04</div>
            </div>
            <div className="tb-ha">
              <IconButton icon="play" label="Прослушать" />
              <IconButton icon="copy" label="Копировать" />
              <IconButton icon="trash" label="Удалить" />
            </div>
          </div>
          <div className="tb-hrow playing">
            <span className="tb-hk">
              <Icon name="keyboard" />
            </span>
            <div className="tb-hb">
              <p>Встреча в 16:10, не забыть про отчёт.</p>
              <div className="tb-hm">Parakeet V3 · сейчас</div>
            </div>
            <div className="tb-ha">
              <IconButton icon="copy" label="Копировать" />
            </div>
          </div>
        </div>
      </div>
      <div className="kp-cell">
        <div className="kp-cap">модели и загрузки</div>
        <div className="kp-demo kp-col">
          <div className="tb-mrow">
            <span className="tb-mi">
              <Icon name="local" />
            </span>
            <div className="tb-mb">
              <b>Parakeet V3</b>
              <small>Быстрая и точная · 478 МБ</small>
              <div className="tb-meter">
                <span>точность ▲▲▲◁</span>
                <span>скорость ▲▲▲▲</span>
                <span>EN · RU · 15 языков</span>
              </div>
            </div>
            <div className="tb-ma">
              <Badge tone="ok">выбрана</Badge>
            </div>
          </div>
          <div className="tb-mrow">
            <span className="tb-mi">
              <Icon name="download" />
            </span>
            <div className="tb-mb">
              <b>Денис</b>
              <small>Piper · 63 МБ · русский</small>
            </div>
            <div className="tb-ma">
              <div className="tb-dl">
                <div className="kp-cap" style={{ fontSize: 11 }}>
                  <i>96 МБ</i>
                  <span>из 190 МБ</span>
                </div>
                <Progress value={0.5} label="Скачивание модели" />
              </div>
            </div>
          </div>
          <div className="tb-mrow">
            <span className="tb-mi">
              <Icon name="history" />
            </span>
            <div className="tb-mb">
              <b>Ирина</b>
              <small>Piper · 63 МБ · русский</small>
            </div>
            <div className="tb-ma">
              <Button size="sm" icon="download">
                Скачать
              </Button>
              <IconButton icon="trash" label="Удалить" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── voice cards ────────────────────────────────────────────── */

function voicesShelf(): ReactNode {
  return (
    <div className="kp-board">
      <div className="kp-demo kp-col">
        <div className="tb-vgrid">
          <div
            className="tb-vcard playing"
            style={{ ["--tb-a" as string]: "120deg" }}
          >
            <div className="tb-vt">
              <b>Денис</b>
              <small>ru · Piper</small>
              <button
                type="button"
                className="tb-star on"
                aria-label="В избранном"
              >
                <Icon name="star-filled" />
              </button>
            </div>
            <div className="tb-mood">низкий, спокойный</div>
            <VoicePortrait voiceId="denis" playing />
            <div className="tb-vf">
              <Tag icon="local">на компьютере</Tag>
              <Badge tone="ink">основной</Badge>
            </div>
          </div>
          <div className="tb-vcard sel">
            <div className="tb-vt">
              <b>Ахирд</b>
              <small>ru · Gemini</small>
              <button
                type="button"
                className="tb-star"
                aria-label="В избранное"
              >
                <Icon name="star" />
              </button>
            </div>
            <div className="tb-mood">тёплый читающий</div>
            <VoicePortrait voiceId="achird" />
            <div className="tb-vf">
              <Tag icon="cloud">OpenRouter</Tag>
              <span className="price">$0.015 / 1k</span>
            </div>
          </div>
          <div className="tb-vcard">
            <div className="tb-vt">
              <b>Рэйчел</b>
              <small>en · ElevenLabs</small>
              <button
                type="button"
                className="tb-star on"
                aria-label="В избранном"
              >
                <Icon name="star-filled" />
              </button>
            </div>
            <div className="tb-mood">собранная, с ускорением 0.7–1.2×</div>
            <VoicePortrait voiceId="rachel" />
            <div className="tb-vf">
              <Tag icon="cloud">OpenRouter</Tag>
              <span className="price">$0.15 / 1k</span>
            </div>
          </div>
          <div className="tb-vcard tb-mine">
            <Icon name="add-voice" />
            <b>Мой голос</b>
            <small>скоро · шесть секунд записи</small>
          </div>
        </div>
        <div className="kp-demo col" style={{ flex: "none" }}>
          <div className="kp-cap">проверка голоса: что прочтётся</div>
          <div className="gp-row">
            <div className="tb-say-preview">
              До{" "}
              <span className="tb-say" data-say="шестнадцатого октября">
                16.10
              </span>{" "}
              сумма{" "}
              <span
                className="tb-say tb-dict"
                data-say="пятнадцать тысяч рублей"
              >
                15 000 ₽
              </span>{" "}
              и всё это читается человеком.
            </div>
            <div className="tb-speed">
              <b>1.05×</b>
              <input
                type="range"
                className="tb-range"
                defaultValue={60}
                aria-label="Скорость"
              />
            </div>
            <div className="tb-reading">
              читает ближе к живой речи, числа говорит по-русски
            </div>
            <div>
              <Button variant="primary" icon="play" playing>
                Прослушать
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── pronunciation playground ──────────────────────────────── */

function pronShelf(): ReactNode {
  return (
    <div className="kp-board">
      <div className="kp-demo kp-col">
        <div className="tb-pron-play">
          <h4>текст → как прочтёт</h4>
          <div className="gp-two">
            <textarea
              className="tb-field"
              rows={3}
              defaultValue="Звонок в 16:30, счёт 12 500 ₽, API отвечает за 0.4 с"
            />
            <div
              className="tb-say-preview"
              style={{ minHeight: 96, background: "var(--tb-paper)" }}
            >
              Звонок в{" "}
              <span className="tb-say" data-say="шестнадцать тридцать">
                16:30
              </span>
              , счёт{" "}
              <span
                className="tb-say tb-dict"
                data-say="двенадцать тысяч пятьсот рублей"
              >
                12 500 ₽
              </span>
              , API отвечает за{" "}
              <span className="tb-say" data-say="ноль целых четыре секунды">
                0.4 с
              </span>{" "}
              и всё произнесено.
            </div>
          </div>
        </div>
        <table className="tb-dict">
          <tbody>
            <tr>
              <td>API</td>
              <td className="arrow">→</td>
              <td>а-пэ-э</td>
              <td>
                <IconButton icon="play" label="Прослушать" />
              </td>
            </tr>
            <tr className="playing">
              <td>ё</td>
              <td className="arrow">→</td>
              <td>.defaults ё везде</td>
              <td>
                <Switch checked onChange={() => {}} label="Всегда ё" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── dictation try stage ───────────────────────────────────── */

function dictationShelf(): ReactNode {
  return (
    <div className="kp-board kp-c2">
      <div className="kp-cell">
        <div className="kp-cap">нажми и держи</div>
        <div className="kp-demo" style={{ gap: 18 }}>
          <button type="button" className="tb-holdbtn">
            <span className="tb-ring" aria-hidden />
            <span className="tb-ring" aria-hidden />
            <span className="tb-ring" aria-hidden />
            <Icon name="microphone" />
            держи и говори
          </button>
          <div className="gp-row" style={{ minWidth: 220 }}>
            <b style={{ fontSize: 15 }}>Встреча в 16:30…</b>
            <div className="tb-field-demo">Здесь поедет распознанный текст</div>
            <div style={{ display: "inline-flex" }} className="tb-level">
              {LEVELS.map((l, i) => (
                <i key={i} style={{ height: `${Math.round(20 + l * 80)}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="kp-cell">
        <div className="kp-cap">свои слова</div>
        <div className="kp-demo">
          <div
            className="tb-wordchips"
            style={{
              border: "1px solid var(--tb-edge)",
              borderRadius: 12,
              width: "100%",
            }}
          >
            <Chips>
              <Chip icon="x">Jira</Chip>
              <Chip icon="x">Tembrio</Chip>
              <button type="button" className="tb-chip">
                +
              </button>
            </Chips>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── tray panel + menu ─────────────────────────────────────── */

function trayPanelShelf(): ReactNode {
  return (
    <div className="kp-board kp-c2">
      <div className="kp-cell">
        <div className="kp-cap">панель у значка</div>
        <div
          className="kp-demo"
          style={{
            minHeight: 330,
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          <div
            className="tb-traypop"
            style={{ position: "relative", right: "auto", bottom: "auto" }}
          >
            <div className="tb-tph">
              <span style={{ height: 20, display: "inline-flex" }}>
                <Wordmark />
              </span>
              <span className="tb-state">
                <i aria-hidden />
                отдыхает
              </span>
            </div>
            <div className="tb-tpv">
              <VoicePortrait voiceId="denis" bars={14} />
              <div>
                <b>Денис</b>
                <small>на компьютере · Piper</small>
              </div>
              <select
                className="tb-field"
                style={{ width: 132 }}
                defaultValue="denis"
                aria-label="Голос"
              >
                <option value="denis">Денис</option>
                <option value="irina">Ирина</option>
              </select>
            </div>
            <div className="tb-tps">
              <span>скорость</span>
              <input
                type="range"
                className="tb-range"
                defaultValue={60}
                aria-label="Скорость"
              />
              <b>1.10×</b>
            </div>
            <div className="tb-tpa">
              <button type="button">
                <b>
                  <Icon name="speaker" /> Прочитать скопированное
                </b>
                клавиша пока не назначена
              </button>
              <button type="button">
                <b>
                  <Icon name="microphone" /> Диктовка
                </b>
                Ctrl + Space
              </button>
            </div>
            <div className="tb-tpf">
              <Kbd>Ctrl</Kbd> <Kbd>Alt</Kbd> <Kbd>S</Kbd>
              <span className="kp-cap" style={{ marginLeft: "auto" }}>
                сегодня $0.18
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="kp-cell">
        <div className="kp-cap">правый щелчок</div>
        <div className="kp-demo" style={{ minHeight: 330 }}>
          <div
            className="tb-traymenu"
            style={{ position: "relative", right: "auto", bottom: "auto" }}
          >
            <button type="button">
              Прочитать скопированное <span>задай клавишу</span>
            </button>
            <button type="button">
              Диктовка <span>Ctrl + Space</span>
            </button>
            <button type="button">
              Пауза чтения <span>Ctrl + Alt + P</span>
            </button>
            <hr />
            <button type="button">
              Настройки <span>открывает окно</span>
            </button>
            <button type="button">Выход</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── onboarding steps ──────────────────────────────────────── */

function onboardingShelf(): ReactNode {
  return (
    <div className="kp-board">
      <div className="kp-demo col">
        <div className="kp-cap">шаг 2: облако или компьютер</div>
        <div className="tb-choice">
          <div className="tb-opt on">
            <b>
              <Icon name="cloud" /> Облако
            </b>
            <p>Сотни голосов, платишь за чтение.</p>
            <ul>
              <li>работает сразу</li>
              <li>нужен интернет</li>
            </ul>
          </div>
          <div className="tb-opt">
            <b>
              <Icon name="local" /> Компьютер
            </b>
            <p>Голос живёт в Tembrio, бесплатный.</p>
            <ul>
              <li>работает без сети</li>
              <li>меньше голосов, нужно скачать</li>
            </ul>
          </div>
        </div>
        <div className="kp-cap">шаг 3: попробуйте озвучку</div>
        <div
          className="tb-flystage tb-ring"
          style={{ ["--tb-a" as string]: "90deg" }}
        >
          <span className="tb-fw tb-hl">До</span>{" "}
          <span className="tb-fw">шестнадцатого</span>…{" "}
          <span className="tb-fw tb-sent">сумма</span>
          <span
            className="tb-farc"
            style={{ borderColor: "var(--tb-s2)" }}
            aria-hidden
          />
          <span
            className="tb-farc"
            style={{ borderColor: "var(--tb-s2)" }}
            aria-hidden
          />
          <span className="tb-fork" aria-hidden>
            <Icon name="fork" />
          </span>
        </div>
        <div className="kp-cap">шаг 5: готово</div>
        <div className="tb-ready">
          <div>
            <b>
              <Icon name="speak-selection" /> Озвучка
            </b>
            Выделите текст и нажмите <Kbd>Ctrl</Kbd> <Kbd>Alt</Kbd> <Kbd>S</Kbd>
            .
          </div>
          <div>
            <b>
              <Icon name="microphone" /> Диктовка
            </b>
            Удерживайте <Kbd>Ctrl</Kbd> <Kbd>Space</Kbd> и говорите.
          </div>
        </div>
      </div>
    </div>
  );
}

export const V5_SHELVES: ShelfDef[] = [
  {
    n: 11,
    title: "Пилюля — все состояния",
    lead: "Тёмный овал всегда один и тот же: короткая запись, распознавание, вставлено, готовлю голос, читает, пауза и сообщения с действием.",
    body: pillShelf(),
  },
  {
    n: 12,
    title: "Значок в трее",
    lead: "Пять состояний иконки: покой, запись, читает, распознаёт и нужна помощь; на тёмной панели — светлые.",
    body: trayShelf(),
  },
  {
    n: 13,
    title: "Строки списков",
    lead: "История, модели и загрузки живут в одних и тех же строках с колонкой и действиями, караоке подсвечивает играющую.",
    body: rowsShelf(),
  },
  {
    n: 14,
    title: "Карточка голоса",
    lead: "Портрет, настроение, из чего читать, цена, звезда; играющая — с бегущей рамкой; чужая — «мой голос, скоро».",
    body: voicesShelf(),
  },
  {
    n: 15,
    title: "Произношение",
    lead: "Песочница «текст → как прочтёт» с подсказками над числами и словарём; каждая строка условия — свой прочтённый повтор.",
    body: pronShelf(),
  },
  {
    n: 16,
    title: "Диктовка: попробовать",
    lead: "Кнопка «нажми и держи» прямо в окне, строка выдачи, уровень с записи и свои слова.",
    body: dictationShelf(),
  },
  {
    n: 17,
    title: "Панель трея и меню",
    lead: "Стекло у значка: голос, скорость, прочитать скопированное, диктовка, траты за сегодня; правый щелчок — короткое меню.",
    body: trayPanelShelf(),
  },
  {
    n: 18,
    title: "Первый запуск",
    lead: "Шаги в окне: облако или компьютер, сцена «слова летят в камертон», готово с двумя подсказками.",
    body: onboardingShelf(),
  },
];
