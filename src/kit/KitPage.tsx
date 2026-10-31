import { useState, type ReactNode } from "react";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Chip,
  Chips,
  Empty,
  Field,
  ForkMark,
  Hotkey,
  Icon,
  ICON_NAMES,
  IconButton,
  Karaoke,
  Kbd,
  LevelMeter,
  PlayButton,
  Progress,
  Range,
  SearchField,
  Segmented,
  Select,
  SettingRow,
  SettingsGroup,
  SoundGradientDefs,
  Spinner,
  Switch,
  Tag,
  TextArea,
  Ticker,
  VoicePortrait,
  Wordmark,
  formatMoney,
  type Currency,
} from "@/design";
import { V5_SHELVES } from "./KitV5";

/*
 * The living version of the v5 showcase: every building block of the
 * «Резонанс» design in both themes. Screenshot tests photograph each shelf,
 * so a change to a token or a component shows up as a visible diff.
 */

type Theme = "system" | "light" | "dark";

const TOKENS = [
  ["paper", "фон окна"],
  ["surface", "карточки"],
  ["surface-2", "подложки"],
  ["edge", "линии"],
  ["ink", "текст, кнопки"],
  ["ink-soft", "вторичный текст"],
  ["ink-faint", "подсказки"],
  ["s1", "звук · начало"],
  ["s2", "звук · середина"],
  ["s3", "звук · конец"],
  ["rec", "запись"],
  ["ok", "готово"],
  ["warn", "внимание"],
  ["err", "ошибка"],
] as const;

const SAMPLE =
  "До 16 октября 2026 года сумма составит 1 500 рублей, а API ответит за 0,4 секунды".split(
    " ",
  );
const LEVELS = [0.1, 0.3, 0.55, 0.8, 0.6, 0.35, 0.7, 0.9, 0.5, 0.25, 0.4, 0.15];

function Shelf({
  n,
  title,
  lead,
  children,
}: {
  n: number;
  title: string;
  lead: string;
  children: ReactNode;
}) {
  return (
    <section className="kp-shelf" data-shelf={n}>
      <h2>
        <span>{n}</span>
        {title}
      </h2>
      <p>{lead}</p>
      {children}
    </section>
  );
}

function Cell({
  cap,
  col,
  children,
}: {
  cap: string;
  col?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="kp-cell">
      <div className="kp-cap">{cap}</div>
      <div className={col ? "kp-demo kp-col" : "kp-demo"}>{children}</div>
    </div>
  );
}

export function KitPage() {
  const [theme, setTheme] = useState<Theme>(
    (document.documentElement.dataset.theme as Theme | undefined) ?? "system",
  );
  const [on, setOn] = useState(true);
  const [mode, setMode] = useState<"hold" | "toggle">("hold");
  const [speed, setSpeed] = useState(1.1);
  const [checked, setChecked] = useState(true);
  const [filter, setFilter] = useState("all");
  const [playing, setPlaying] = useState(false);
  const [word, setWord] = useState(4);
  const [spent, setSpent] = useState(0.184);
  const [currency, setCurrency] = useState<Currency>("usd");

  const pickTheme = (next: Theme) => {
    setTheme(next);
    if (next === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
  };

  return (
    <div className="tb-root" style={{ minHeight: "100vh" }}>
      <SoundGradientDefs />
      <div className="kp-sheet">
        <div className="kp-top">
          <Wordmark />
          <h1>Набор элементов «Резонанс»</h1>
          <span className="kp-sp" />
          <Segmented
            label="Тема"
            value={theme}
            onChange={pickTheme}
            options={[
              { value: "light", label: "Светлая" },
              { value: "dark", label: "Тёмная" },
              { value: "system", label: "Как в системе" },
            ]}
          />
        </div>
        <p className="kp-lead">
          Правило: в покое интерфейс — бумага и чернила. Градиент звука горит
          только там, где сейчас звучит голос, коралловый — только во время
          записи. Кнопки и переключатели всегда чернильные.
        </p>

        <Shelf
          n={1}
          title="Логотип"
          lead="Камертон-«T», два круга резонанса и «embrio» (Grand Hotel, OFL, в контурах). Пока звучит голос, камертон берёт градиент, а круги пульсируют."
        >
          <div className="kp-board kp-c3">
            <Cell cap="в покое">
              <div style={{ height: 44 }}>
                <Wordmark />
              </div>
            </Cell>
            <Cell cap="звучит">
              <div style={{ height: 44 }}>
                <Wordmark sounding />
              </div>
            </Cell>
            <Cell cap="камертон: 16 · 24 · 32 · 64">
              <div className="kp-forks">
                {[16, 24, 32, 64].map((size) => (
                  <div key={size} style={{ height: size }}>
                    <ForkMark />
                  </div>
                ))}
              </div>
            </Cell>
          </div>
        </Shelf>

        <Shelf
          n={2}
          title="Цвета"
          lead="Каждый цвет — пара для светлой и тёмной темы (src/design/tokens.css)."
        >
          <div className="kp-board">
            <div className="kp-swatches">
              {TOKENS.map(([name, role]) => (
                <div key={name}>
                  <i style={{ background: `var(--tb-${name})` }} />
                  <span>
                    {role}
                    <br />
                    <code>--tb-{name}</code>
                  </span>
                </div>
              ))}
              <div>
                <i style={{ background: "var(--tb-sound)" }} />
                <span>
                  звук
                  <br />
                  <code>--tb-sound</code>
                </span>
              </div>
            </div>
          </div>
        </Shelf>

        <Shelf
          n={3}
          title="Шрифт"
          lead="Системный шрифт: Segoe UI на Windows, San Francisco на Mac. Цифры в суммах — моноширинные по ширине."
        >
          <div className="kp-board kp-typo">
            <div>
              <small>заголовок · 22</small>
              <span style={{ fontSize: 22, fontWeight: 700 }}>Голоса</span>
            </div>
            <div>
              <small>карточка · 15</small>
              <b style={{ fontSize: 15 }}>Денис</b>
            </div>
            <div>
              <small>текст · 13,5</small>
              <span style={{ fontSize: 13.5 }}>
                Выделите текст и нажмите <Kbd>Ctrl</Kbd> <Kbd>Alt</Kbd>{" "}
                <Kbd>S</Kbd>
              </span>
            </div>
            <div>
              <small>подсказка · 12,5</small>
              <span style={{ fontSize: 12.5, color: "var(--tb-ink-soft)" }}>
                Читает чуть медленнее, чем говорит человек
              </span>
            </div>
            <div>
              <small>подпись · 12</small>
              <span className="kp-cap">Горячие клавиши</span>
            </div>
          </div>
        </Shelf>

        <Shelf
          n={4}
          title="Иконки"
          lead="Сетка 24 px, линия 2 px. Обводка берётся из --tb-icon-stroke, поэтому «звучащей» иконке достаточно одной переменной."
        >
          <div className="kp-board">
            <div className="kp-icons">
              {ICON_NAMES.map((name) => (
                <div key={name}>
                  <Icon name={name} />
                  {name}
                </div>
              ))}
            </div>
            <Cell cap="звучащая иконка">
              <span className="kp-sound">
                <Icon name="speaker" style={{ width: 28, height: 28 }} />
              </span>
              <span className="kp-sound">
                <Icon name="voices" style={{ width: 28, height: 28 }} />
              </span>
            </Cell>
          </div>
        </Shelf>

        <Shelf
          n={5}
          title="Кнопки"
          lead="Главная кнопка — чернильная. «Прослушать» получает кольцо звука, только пока её голос звучит."
        >
          <div className="kp-board kp-c3">
            <Cell cap="виды">
              <Button variant="primary" icon="play">
                Прослушать
              </Button>
              <Button icon="download">Скачать</Button>
              <Button variant="ghost">Отмена</Button>
              <Button variant="danger" icon="trash">
                Удалить
              </Button>
            </Cell>
            <Cell cap="маленькие и выключенные">
              <Button size="sm">Проверить</Button>
              <Button size="sm" variant="primary">
                Сохранить
              </Button>
              <Button disabled>Недоступно</Button>
            </Cell>
            <Cell cap="звучит / не звучит">
              <Button
                icon={playing ? "stop" : "play"}
                playing={playing}
                onClick={() => setPlaying(!playing)}
              >
                {playing ? "Стоп" : "Прослушать"}
              </Button>
              <Button icon="stop" playing>
                Стоп
              </Button>
            </Cell>
            <Cell cap="кнопки-иконки">
              <IconButton icon="copy" label="Копировать" />
              <IconButton icon="refresh" label="Повторить" />
              <IconButton icon="trash" label="Удалить" />
              <IconButton icon="settings" label="Настройки" disabled />
            </Cell>
            <Cell cap="прослушать голос">
              <PlayButton playing={false} label="Прослушать" />
              <PlayButton playing label="Остановить" />
            </Cell>
          </div>
        </Shelf>

        <Shelf
          n={6}
          title="Поля и клавиши"
          lead="Поле в фокусе обводится чернилами. Поле клавиш показывает сочетание как клавиши на клавиатуре."
        >
          <div className="kp-board kp-c3">
            <Cell cap="поле и список" col>
              <Field placeholder="sk-or-…" defaultValue="" />
              <Select defaultValue="ru">
                <option value="ru">Русский</option>
                <option value="en">English</option>
              </Select>
            </Cell>
            <Cell cap="поиск и текст" col>
              <SearchField placeholder="Найти голос" />
              <TextArea rows={2} defaultValue="Проверка: 16.10.2026, 1500 ₽" />
            </Cell>
            <Cell cap="горячие клавиши" col>
              <Hotkey keys={["Ctrl", "Alt", "S"]} />
              <Hotkey keys={[]} capturing capturingText="Нажмите сочетание…" />
            </Cell>
          </div>
        </Shelf>

        <Shelf
          n={7}
          title="Выбор"
          lead="Переключатели, сегменты, флажки, ползунок и фильтры — все чернильные."
        >
          <div className="kp-board kp-c3">
            <Cell cap="переключатель">
              <Switch checked={on} onChange={setOn} label="Звуки записи" />
              <Switch checked={false} onChange={() => {}} label="Выключено" />
            </Cell>
            <Cell cap="сегменты">
              <Segmented
                label="Режим"
                value={mode}
                onChange={setMode}
                options={[
                  { value: "hold", label: "Удерживать" },
                  { value: "toggle", label: "Нажать дважды" },
                ]}
              />
            </Cell>
            <Cell cap="флажок">
              <Checkbox
                checked={checked}
                onChange={(event) => setChecked(event.target.checked)}
              >
                Вернуть буфер обмена
              </Checkbox>
            </Cell>
            <Cell cap="ползунок скорости" col>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <Range
                  value={speed}
                  min={0.7}
                  max={1.2}
                  step={0.05}
                  onChange={setSpeed}
                  aria-label="Скорость"
                />
                <b style={{ width: 44, textAlign: "right" }}>
                  {speed.toFixed(2)}×
                </b>
              </div>
            </Cell>
            <Cell cap="фильтры">
              <Chips>
                {[
                  ["all", "Все"],
                  ["cloud", "Облако"],
                  ["local", "На компьютере"],
                  ["fav", "Избранные"],
                ].map(([value, label]) => (
                  <Chip
                    key={value}
                    on={filter === value}
                    onClick={() => setFilter(value)}
                  >
                    {label}
                  </Chip>
                ))}
              </Chips>
            </Cell>
          </div>
        </Shelf>

        <Shelf
          n={8}
          title="Метки и сообщения"
          lead="Статусы, сообщения с действием, ход загрузки, пустой список."
        >
          <div className="kp-board kp-c2">
            <Cell cap="метки">
              <Badge tone="ok">скачана</Badge>
              <Badge tone="warn">мало места</Badge>
              <Badge tone="err">ошибка</Badge>
              <Badge>облако</Badge>
              <Badge tone="ink">основной</Badge>
              <Tag icon="cloud">OpenRouter</Tag>
              <Tag icon="local">Piper</Tag>
              <Tag icon="license">MIT</Tag>
            </Cell>
            <Cell cap="загрузка" col>
              <Progress value={0.42} label="Скачивание" />
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Spinner label="Загрузка" /> Загружаю список голосов…
              </div>
            </Cell>
            <Cell cap="сообщения" col>
              <Alert tone="info" title="Ключ хранится в системе">
                Tembrio не держит его в файлах настроек.
              </Alert>
              <Alert tone="ok" title="Ключ подошёл">
                Баланс: $12.40
              </Alert>
              <Alert
                tone="warn"
                title="Сегодня потрачено больше лимита"
                action={<Button size="sm">Изменить</Button>}
              >
                Лимит $0.50, потрачено $0.62.
              </Alert>
              <Alert
                tone="err"
                title="Нет ключа OpenRouter"
                action={
                  <Button size="sm" variant="primary">
                    Добавить
                  </Button>
                }
              >
                Без него облачные голоса не работают.
              </Alert>
            </Cell>
            <Cell cap="пусто" col>
              <Empty
                icon="history"
                title="История пуста"
                action={<Button size="sm">Как начать</Button>}
              >
                Здесь появится всё, что вы озвучили и надиктовали.
              </Empty>
            </Cell>
          </div>
        </Shelf>

        <Shelf
          n={9}
          title="Группа настроек"
          lead="Белая карточка со строками: слева что это и подсказка, справа управление."
        >
          <div className="kp-board">
            <SettingsGroup title="Диктовка">
              <SettingRow
                title="Клавиша"
                hint="Удерживайте и говорите, отпустите — текст вставится"
              >
                <Hotkey keys={["Ctrl", "Space"]} />
              </SettingRow>
              <SettingRow
                title="Звуки записи"
                hint="Короткий щелчок в начале и в конце"
              >
                <Switch checked={on} onChange={setOn} label="Звуки записи" />
              </SettingRow>
              <SettingRow title="Где распознавать">
                <Segmented
                  label="Где распознавать"
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "hold", label: "Облако" },
                    { value: "toggle", label: "Компьютер" },
                  ]}
                />
              </SettingRow>
            </SettingsGroup>
          </div>
        </Shelf>

        <Shelf
          n={10}
          title="Звук"
          lead="Портрет голоса, бегущая строка, счётчик трат и уровень микрофона. Цвет появляется только во время звука."
        >
          <div className="kp-board kp-c2">
            <Cell cap="портрет: тишина / звучит" col>
              <VoicePortrait voiceId="piper:ru_RU-denis-medium" />
              <VoicePortrait voiceId="piper:ru_RU-denis-medium" playing />
              <VoicePortrait voiceId="openrouter:achird" />
            </Cell>
            <Cell cap="караоке" col>
              <Karaoke words={SAMPLE} current={word} />
              <div style={{ display: "flex", gap: 8 }}>
                <Button
                  size="sm"
                  onClick={() => setWord((word + 1) % SAMPLE.length)}
                >
                  Следующее слово
                </Button>
              </div>
            </Cell>
            <Cell cap="счётчик трат">
              <b style={{ fontSize: 34, fontWeight: 700 }}>
                <Ticker value={formatMoney(spent, currency, 96.4)} />
              </b>
              <Button size="sm" onClick={() => setSpent(spent + 0.0137)}>
                + фраза
              </Button>
              <Segmented
                label="Валюта"
                value={currency}
                onChange={setCurrency}
                options={[
                  { value: "usd", label: "$" },
                  { value: "rub", label: "₽" },
                ]}
              />
            </Cell>
            <Cell cap="микрофон: тихо / запись">
              <LevelMeter levels={LEVELS.map(() => 0)} />
              <LevelMeter levels={LEVELS} live />
            </Cell>
          </div>
        </Shelf>
        {V5_SHELVES.map((shelf) => (
          <Shelf
            key={shelf.n}
            n={shelf.n}
            title={shelf.title}
            lead={shelf.lead}
          >
            {shelf.body}
          </Shelf>
        ))}
      </div>
    </div>
  );
}
