export class TuiStreamAssembler {
  private text = ""
  private finished = false
  private lastSeq = 0

  reset() {
    this.text = ""
    this.finished = false
    this.lastSeq = 0
  }

  getText() {
    return this.text
  }

  pushDelta(delta: string, seq?: number) {
    if (!delta || this.finished) return this.text
    if (seq !== undefined && seq <= this.lastSeq) return this.text
    if (seq !== undefined) this.lastSeq = seq

    this.text += delta
    return this.text
  }

  pushFinal(finalText: string) {
    if (!finalText) {
      this.finished = true
      return this.text
    }

    if (!this.text) {
      this.text = finalText
      this.finished = true
      return this.text
    }

    if (finalText.length >= this.text.length && finalText.includes(this.text)) {
      this.text = finalText
      this.finished = true
      return this.text
    }

    if (finalText.length > this.text.length) {
      this.text = finalText
    }
    this.finished = true
    return this.text
  }
}
