<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  Branch,
  Currency,
  DateTime,
  Num,
  Plural,
  T,
  Var,
  useGT,
  useLocale,
  useMessages,
  useSetLocale,
} from 'gt-vue';
import { files, footerNote, specs } from './content';
import Crosses from './Crosses.vue';
import GtMark from './GtMark.vue';

type Billing = 'monthly' | 'yearly';

defineProps<{ locales: readonly string[] }>();

const MONTHLY_PRICE = 8;
const YEARLY_PRICE = 80;
const RELEASE_DATE = new Date(2026, 8, 24);
const TRIAL_DAYS = 14;

const gt = useGT();
const m = useMessages();
const locale = useLocale();
const setLocale = useSetLocale();

const billing = ref<Billing>('yearly');
const seats = ref(3);
const team = ref('Northwind');
const started = ref(false);

const localeName = (code: string) => {
  const name = new Intl.DisplayNames([code], { type: 'language' }).of(code);
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : code;
};

const unitPrice = computed(() =>
  billing.value === 'monthly' ? MONTHLY_PRICE : YEARLY_PRICE
);
const total = computed(() => unitPrice.value * seats.value);
const trialEnds = computed(() => {
  const date = new Date(2026, 9, 2);
  date.setDate(date.getDate() + TRIAL_DAYS);
  return date;
});
const teamName = computed(() => team.value.trim() || 'Northwind');

document.documentElement.lang = locale.value;

function selectLocale(event: Event) {
  void setLocale((event.target as HTMLSelectElement).value);
}
</script>

<template>
  <div class="gt-frame">
    <header class="gt-nav">
      <a class="gt-mark" href="#top">
        <GtMark />
        <span class="nav-divider" aria-hidden="true" />
        <span>Quire</span>
      </a>
      <select
        name="generaltranslation-locale"
        :aria-label="gt('Language')"
        :value="locale"
        @change="selectLocale"
      >
        <option v-for="code in locales" :key="code" :value="code">
          {{ localeName(code) }}
        </option>
      </select>
      <Crosses />
    </header>

    <main id="top">
      <section class="gt-row gt-cells hero">
        <div class="cell hero-copy">
          <T>
            <p class="gt-label">Notes app for small teams</p>
            <h1>Plain text notes that sync in 200 ms.</h1>
            <p class="gt-lead">
              Quire saves every note as a Markdown file on your disk. Sync is
              end-to-end encrypted, and you can open the folder in any editor.
            </p>
          </T>
          <div class="actions">
            <a class="gt-button" href="#pricing">
              {{ gt('Start Free Trial') }}
            </a>
            <a class="gt-button outline" href="#faq">
              {{ gt('Read The FAQ') }}
            </a>
          </div>
          <T>
            <p class="meta-line">
              Version 4.2 shipped on
              <DateTime
                :value="RELEASE_DATE"
                :options="{ dateStyle: 'medium' }"
              />
              to
              <Num :value="12480" />
              writers.
            </p>
          </T>
        </div>
        <div class="cell plate">
          <div class="file-list">
            <p class="file-head gt-mono">~/Quire</p>
            <ul>
              <li v-for="file in files" :key="file.name" class="gt-mono">
                <span>{{ file.name }}</span>
                <span class="file-size">
                  <Num
                    :value="file.bytes / 1024"
                    :options="{ maximumFractionDigits: 1 }"
                  />
                  KB
                </span>
              </li>
            </ul>
          </div>
        </div>
        <Crosses />
      </section>

      <section class="gt-row gt-cells specs">
        <div
          v-for="spec in specs"
          :key="spec.unit + spec.value"
          class="cell spec"
        >
          <p class="spec-value">
            <Num :value="spec.value" />
            <span v-if="spec.unit" class="spec-unit">{{ spec.unit }}</span>
          </p>
          <p class="gt-label">{{ m(spec.label) }}</p>
        </div>
        <Crosses />
      </section>

      <div class="gt-hatch hatch" aria-hidden="true"><Crosses /></div>

      <section id="pricing" class="gt-row gt-cells pricing">
        <div class="cell">
          <T>
            <p class="gt-label">Pricing</p>
            <h2>One plan. Pay per seat.</h2>
          </T>

          <fieldset class="field">
            <legend class="gt-label">{{ gt('Billing') }}</legend>
            <div class="segmented">
              <button
                type="button"
                :aria-pressed="billing === 'monthly'"
                @click="billing = 'monthly'"
              >
                {{ gt('Monthly') }}
              </button>
              <button
                type="button"
                :aria-pressed="billing === 'yearly'"
                @click="billing = 'yearly'"
              >
                {{ gt('Yearly') }}
              </button>
            </div>
            <T>
              <p class="note">
                <Branch :branch="billing">
                  <template #monthly>
                    Billed every month. Cancel any time.
                  </template>
                  <template #yearly>
                    Billed once a year. Two months are free.
                  </template>
                  Billed per seat.
                </Branch>
              </p>
            </T>
          </fieldset>

          <fieldset class="field">
            <legend class="gt-label">{{ gt('Seats') }}</legend>
            <div class="stepper">
              <button
                type="button"
                :aria-label="gt('Remove a seat')"
                :disabled="seats <= 1"
                @click="seats = Math.max(1, seats - 1)"
              >
                −
              </button>
              <output class="gt-mono"><Num :value="seats" /></output>
              <button
                type="button"
                :aria-label="gt('Add a seat')"
                :disabled="seats >= 50"
                @click="seats = Math.min(50, seats + 1)"
              >
                +
              </button>
            </div>
          </fieldset>

          <label class="field">
            <span class="gt-label">{{ gt('Team name') }}</span>
            <input v-model="team" class="text-input" maxlength="32" />
          </label>
        </div>

        <div class="cell summary">
          <T><p class="gt-label">Summary</p></T>
          <dl class="summary-list">
            <div>
              <dt>{{ gt('Seats') }}</dt>
              <dd>
                <T>
                  <Plural :n="seats">
                    <template #one>One seat</template>
                    <template #other>
                      <Num :value="seats" />
                      seats
                    </template>
                  </Plural>
                </T>
              </dd>
            </div>
            <div>
              <dt>{{ gt('Price per seat') }}</dt>
              <dd><Currency :value="unitPrice" currency="USD" /></dd>
            </div>
            <div>
              <dt>{{ gt('Total') }}</dt>
              <dd><Currency :value="total" currency="USD" /></dd>
            </div>
            <div>
              <dt>{{ gt('Trial ends') }}</dt>
              <dd>
                <DateTime :value="trialEnds" :options="{ dateStyle: 'long' }" />
              </dd>
            </div>
          </dl>
          <T>
            <p class="note">
              Invoices go to the
              <Var>{{ teamName }}</Var>
              workspace. You pay nothing until the trial ends.
            </p>
          </T>
          <button type="button" class="gt-button start" @click="started = true">
            {{ gt('Start Free Trial') }}
          </button>
          <T v-if="started">
            <p class="note confirm">
              The
              <Var>{{ teamName }}</Var>
              trial has started. Sign-up is disabled in this example.
            </p>
          </T>
        </div>
        <Crosses />
      </section>

      <section id="faq" class="gt-row gt-cells faq">
        <div class="cell">
          <T>
            <h3>Where are my notes stored?</h3>
            <p>
              In a folder you choose. Our servers hold only encrypted copies for
              sync.
            </p>
          </T>
        </div>
        <div class="cell">
          <T>
            <h3>Can I leave?</h3>
            <p>
              Yes. Your notes are plain Markdown files, so there is nothing to
              export.
            </p>
          </T>
        </div>
        <div class="cell">
          <T>
            <h3>Does it work offline?</h3>
            <p>
              Every edit is saved locally first. Sync resumes when you are back
              online.
            </p>
          </T>
        </div>
        <Crosses />
      </section>
    </main>

    <footer class="gt-row footer">
      <p class="gt-label">{{ footerNote }}</p>
      <span class="gt-mono locale-code">{{ locale }}</span>
      <Crosses />
    </footer>
  </div>
</template>
