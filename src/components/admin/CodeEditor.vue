<script setup>
// CodeMirror 6 for the file manager: highlighting by language, line numbers, search,
// Ctrl+S to save. Loaded only on the page that uses it.
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState, Compartment } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { yaml } from '@codemirror/lang-yaml'
import { json } from '@codemirror/lang-json'
import { StreamLanguage } from '@codemirror/language'
import { properties } from '@codemirror/legacy-modes/mode/properties'
import { toml } from '@codemirror/legacy-modes/mode/toml'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import { oneDark } from '@codemirror/theme-one-dark'

const props = defineProps({
  modelValue: { type: String, default: '' },
  language: { type: String, default: 'text' },
  readonly: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'save'])

const host = ref(null)
let view = null
const lang = new Compartment()
const ro = new Compartment()

function languageOf(name) {
  switch (name) {
    case 'yaml': return yaml()
    case 'json': return json()
    case 'properties': return StreamLanguage.define(properties)
    case 'toml': return StreamLanguage.define(toml)
    case 'shell': return StreamLanguage.define(shell)
    default: return []
  }
}

onMounted(() => {
  view = new EditorView({
    parent: host.value,
    state: EditorState.create({
      doc: props.modelValue,
      extensions: [
        basicSetup,
        oneDark,
        lang.of(languageOf(props.language)),
        ro.of(EditorState.readOnly.of(props.readonly)),
        keymap.of([{ key: 'Mod-s', preventDefault: true, run: () => { emit('save'); return true } }]),
        EditorView.updateListener.of((u) => { if (u.docChanged) emit('update:modelValue', u.state.doc.toString()) }),
        EditorView.theme({ '&': { height: '100%', fontSize: '13px' }, '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' } }),
      ],
    }),
  })
})

watch(() => props.modelValue, (v) => {
  if (view && v !== view.state.doc.toString()) {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: v } })
  }
})
watch(() => props.language, (l) => view?.dispatch({ effects: lang.reconfigure(languageOf(l)) }))
watch(() => props.readonly, (r) => view?.dispatch({ effects: ro.reconfigure(EditorState.readOnly.of(r)) }))

onBeforeUnmount(() => view?.destroy())
</script>

<template>
  <div ref="host" class="code-editor" />
</template>

<style scoped>
.code-editor { height: 100%; min-height: 20rem; border-radius: 10px; overflow: hidden; border: 1px solid var(--adm-line); }
</style>
