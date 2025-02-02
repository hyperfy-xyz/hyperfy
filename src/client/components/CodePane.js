import { useEffect, useRef, useState } from 'react'
import { css } from '@firebolt-dev/css'
import { usePane } from './usePane'
import { FileCode2Icon, XIcon } from 'lucide-react'
import { hashFile } from '../../core/utils-client'

export function CodePane({ entity, onClose, world }) {
  const paneRef = useRef()
  const headRef = useRef()
  const containerRef = useRef()
  const codeRef = useRef()
  const [editor, setEditor] = useState(null)
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)

  // Save function (unchanged)
  const save = async () => {
    const blueprint = entity.blueprint
    const code = codeRef.current

    // Convert code to a file.
    const blob = new Blob([code], { type: 'text/plain' })
    const file = new File([blob], 'script.js', { type: 'text/plain' })

    // Generate an immutable hash for the file.
    const hash = await hashFile(file)
    const filename = `${hash}.js`
    const url = `asset://${filename}`

    // Cache the file locally.
    world.loader.insert('script', url, file)

    // Update the blueprint locally.
    const version = blueprint.version + 1
    world.blueprints.modify({ id: blueprint.id, version, script: url })

    // Upload the script file.
    await world.network.upload(file)

    // Broadcast the blueprint change.
    world.network.send('blueprintModified', { id: blueprint.id, version, script: url })
  }

  // Build the messages array for few-shot in-context learning.
  const buildMessages = (userInquiry) => {
    return [
      {
        role: 'system',
        content:
          'You are a coding assistant. Provide only JavaScript code in your responses. Do not use any code block formatting.'
      },
      // Example 1:
      {
        role: 'user',
        content: 'Make this object float for me!'
      },
      {
        role: 'assistant',
        content:
          "const floatConfig = { vertical: { maxPos: 6, minPos: 1, floatSpeed: 1, floatIntensity: 0.1, direction: 1 }, rotation: { rotationSpeed: 1, y: { amplitude: Math.PI/8, direction: 1 }, x: { amplitude: Math.PI/24, direction: 1 }, z: { amplitude: Math.PI/24, direction: 1 } }, scale: { minScale: 1, maxScale: 1.2, scaleSpeed: 1.5, direction: 1 } }; let time = 0; function oscillate(t, speed, center, amplitude, multiplier = 1, direction = 1) { return center + amplitude * Math.sin(t * speed * multiplier) * direction; } app.on('update', delta => { time += delta; const { maxPos, minPos, floatSpeed, floatIntensity, direction } = floatConfig.vertical; const verticalAmplitude = (maxPos - minPos) / 2; const verticalCenter = (maxPos + minPos) / 2; app.position.y = oscillate(time, floatSpeed, verticalCenter, verticalAmplitude * floatIntensity, 1, direction); const { rotationSpeed, y, x, z } = floatConfig.rotation; app.rotation.y = oscillate(time, rotationSpeed, 0, y.amplitude, 1, y.direction); app.rotation.x = oscillate(time, rotationSpeed, 0, x.amplitude, 1.1, x.direction); app.rotation.z = oscillate(time, rotationSpeed, 0, z.amplitude, 1.2, z.direction); const { minScale, maxScale, scaleSpeed, direction: scaleDirection } = floatConfig.scale; const scaleAmplitude = (maxScale - minScale) / 2; const scaleCenter = (maxScale + minScale) / 2; app.scale = oscillate(time, scaleSpeed, scaleCenter, scaleAmplitude, 1, scaleDirection); });"
      },
      // Example 2:
      {
        role: 'user',
        content: 'Make this object spin in circles while gradually scaling up and down!'
      },
      {
        role: 'assistant',
        content:
          "const minSpeed = 0.01, maxSpeed = 0.02; let currentSpeed = 0.01, speedIncrement = 0.001; const minScale = 0.5, maxScale = 20.0; let currentScale = 1.0, scaleIncrement = 2; app.on('update', delta => { currentSpeed += speedIncrement * delta; if (currentSpeed >= maxSpeed || currentSpeed <= minSpeed) { speedIncrement *= -1; } currentSpeed = Math.min(maxSpeed, Math.max(minSpeed, currentSpeed)); currentScale += scaleIncrement * delta; if (currentScale >= maxScale || currentScale <= minScale) { scaleIncrement *= -1; } app.scale.set(currentScale, currentScale, currentScale); const rotation = currentSpeed * delta * 360; app.rotation.y += rotation; app.rotation.y %= 360; });"
      },
      // Example 3:
      {
        role: 'user',
        content: 'Raise up and down in a set way.'
      },
      {
        role: 'assistant',
        content:
          "const maxPos = 5, minPos = 0, speed = 2; let direction = 1; app.on('update', delta => { const movement = speed * delta; app.position.y += movement * direction; if (app.position.y >= maxPos) { app.position.y = maxPos; direction = -1; } else if (app.position.y <= minPos) { app.position.y = minPos; direction = 1; } });"
      },
      // Example 4:
      {
        role: 'user',
        content: 'Make the car go sideways and go in large circles!'
      },
      {
        role: 'assistant',
        content:
          "const radius = 35, speed = 0.1, swerveIntensity = 0.69; let angle = 0, swerveAngle = 0; app.on('update', delta => { const angularVelocity = speed * 2 * Math.PI; angle -= angularVelocity * delta; angle %= 2 * Math.PI; swerveAngle += delta; const swerveOffset = Math.sin(swerveAngle) * swerveIntensity, effectiveRadius = radius + swerveOffset; app.position.x = effectiveRadius * Math.cos(angle); app.position.z = effectiveRadius * Math.sin(angle); app.rotation.y = -(angle + Math.atan2(swerveOffset, radius)); });"
      },
      // The actual user inquiry
      {
        role: 'user',
        content: userInquiry
      }
    ]
  }

  // Handler for generating code using GPT-4o via the chat completions endpoint.
  // After new code is generated and inserted into the editor, the code is automatically saved.
  const handleGenerateCode = async () => {
    if (!prompt.trim()) return
    setGenerating(true)
    try {
      const messages = buildMessages(prompt)
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // WARNING: Do not expose your API key in production code!
          'Authorization': 'Bearer OPENAPIKEY' // Replace with your actual API key.
        },
        body: JSON.stringify({
          model: 'gpt-4o', // or your designated model, e.g., "gpt-4-mini" if applicable
          messages,
          max_tokens: 1024,
          temperature: 0.75
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('OpenAI API error:', errorData)
        throw new Error('OpenAI API returned an error')
      }

      const data = await response.json()
      if (data?.choices && data.choices[0]?.message?.content) {
        const generatedCode = data.choices[0].message.content
        // Replace the entire content with the generated code.
        editor.setValue(generatedCode)
        codeRef.current = generatedCode
        // Automatically save the new code.
        await save()
      } else {
        console.error('No code returned from OpenAI API')
      }
    } catch (error) {
      console.error('Error generating code:', error)
    } finally {
      setGenerating(false)
    }
  }

  // Attach this pane to the application's pane management system.
  usePane('code', paneRef, headRef, true)

  // Load and initialize the Monaco editor.
  useEffect(() => {
    let dead = false
    load().then(monaco => {
      if (dead) return
      // Load existing code or use a default placeholder.
      codeRef.current = entity.script?.code || '// ...'
      const container = containerRef.current
      const editorInstance = monaco.editor.create(container, {
        value: codeRef.current,
        language: 'javascript',
        scrollBeyondLastLine: true,
        lineNumbers: 'on',
        minimap: { enabled: false },
        automaticLayout: true,
        tabSize: 2,
        insertSpaces: true
      })
      // Update codeRef whenever the editor content changes.
      editorInstance.onDidChangeModelContent(() => {
        codeRef.current = editorInstance.getValue()
      })
      // Add a save action bound to Ctrl+S / Cmd+S.
      editorInstance.addAction({
        id: 'save',
        label: 'Save',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
        run: save
      })
      setEditor(editorInstance)
    })
    return () => {
      dead = true
    }
  }, [])

  return (
    <div
      ref={paneRef}
      className="acode"
      css={css`
        position: absolute;
        top: 40px;
        left: 40px;
        width: 640px;
        height: 520px;
        background: rgba(22, 22, 28, 1);
        border: 1px solid rgba(255, 255, 255, 0.03);
        border-radius: 10px;
        box-shadow: rgba(0, 0, 0, 0.5) 0px 10px 30px;
        pointer-events: auto;
        display: flex;
        resize: both;
        overflow: auto;
        flex-direction: column;
      `}
    >
      <div
        className="acode-head"
        ref={headRef}
        css={css`
          height: 40px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          padding: 0 0 0 10px;
        `}
      >
        <FileCode2Icon size={20} />
        <div
          className="acode-head-title"
          css={css`
            padding-left: 7px;
            font-weight: 500;
            flex: 1;
          `}
        >
          Script
        </div>
        <div
          className="acode-head-close"
          onClick={() => world.emit('code', null)}
          css={css`
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          `}
        >
          <XIcon size={20} />
        </div>
      </div>
      <div
        className="acode-content"
        css={css`
          flex: 1;
          position: relative;
          overflow: hidden;
          border-bottom-left-radius: 10px;
          border-bottom-right-radius: 10px;
        `}
      >
        <div
          className="acode-container"
          ref={containerRef}
          css={css`
            position: absolute;
            inset: 0;
            top: 20px;
          `}
        />
      </div>
      {/* Area for prompt entry and code generation */}
      <div
        className="acode-generator"
        css={css`
          padding: 10px;
          background: #16161c;
          border-top: 1px solid rgba(255, 255, 255, 0.03);
        `}
      >
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter prompt for code generation..."
          css={css`
            width: 100%;
            height: 60px;
            resize: vertical;
            padding: 8px;
            background: #1a1a1e;
            border: 1px solid #333;
            color: #fff;
            font-size: 14px;
          `}
        />
        <button
          onClick={handleGenerateCode}
          disabled={generating}
          css={css`
            margin-top: 8px;
            padding: 8px 16px;
            background: ${generating ? '#888' : '#4fc1ff'};
            border: none;
            border-radius: 4px;
            color: #000;
            cursor: pointer;
            &:hover {
              background: ${generating ? '#888' : '#3fa0d8'};
            }
          `}
        >
          {generating ? 'Generating...' : 'Generate Code'}
        </button>
      </div>
    </div>
  )
}

// Function to load the Monaco Editor dynamically.
let promise
const load = () => {
  if (promise) return promise
  promise = new Promise(async resolve => {
    // Set up require.js paths for Monaco.
    window.require = {
      paths: {
        vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.49.0/min/vs'
      }
    }
    // Load the Monaco loader script.
    await new Promise(resolve => {
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.49.0/min/vs/loader.js'
      script.onload = () => resolve()
      document.head.appendChild(script)
    })
    // Load the Monaco editor.
    await new Promise(resolve => {
      window.require(['vs/editor/editor.main'], () => {
        resolve()
      })
    })
    // Define and set a custom theme.
    monaco.editor.defineTheme('default', darkPlusTheme)
    monaco.editor.setTheme('default')
    resolve(window.monaco)
  })
  return promise
}

// Dark Plus Theme for the Monaco editor.
const darkPlusTheme = {
  inherit: true,
  base: 'vs-dark',
  rules: [
    { foreground: '#DCDCAA', token: 'entity.name.function' },
    { foreground: '#C586C0', token: 'keyword.control' }
  ],
  colors: {
    'editor.background': '#16161c'
  },
  encodedTokensColors: []
}
