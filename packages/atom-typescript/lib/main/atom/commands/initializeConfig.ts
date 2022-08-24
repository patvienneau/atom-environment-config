import {BufferedNodeProcess} from "atom"
import {resolveBinary} from "../../../client"
import {addCommand} from "./registry"

addCommand("atom-text-editor", "typescript:initialize-config", () => ({
  description: "Create tsconfig.json in the project related to currently-active text edtior",
  async didDispatch(editor, abort) {
    const projectDirs = atom.project.getDirectories()
    if (projectDirs.length === 0) return abort()

    const currentPath = editor.getPath()
    if (currentPath === undefined) return

    const pathToTsc = (await resolveBinary(currentPath, "tsc")).pathToBin

    for (const projectDir of projectDirs) {
      if (projectDir.contains(currentPath)) {
        await initConfig(pathToTsc, projectDir.getPath())
        atom.notifications.addSuccess(
          `Successfully created tsconfig.json in ${projectDir.getPath()}`,
        )
      }
    }
  },
}))

async function initConfig(tsc: string, projectRoot: string): Promise<void> {
  let disp: {dispose: () => void} | undefined
  try {
    return await new Promise<void>((resolve, reject) => {
      try {
        const bnp = new BufferedNodeProcess({
          command: tsc,
          args: ["--init"],
          options: {cwd: projectRoot},
          exit: (code) => {
            if (code === 0) resolve()
            else reject(new Error(`Tsc ended with nonzero exit code ${code}`))
          },
        })
        disp = bnp.onWillThrowError(reject)
      } catch (e) {
        reject(e)
      }
    })
  } finally {
    if (disp) disp.dispose()
  }
}
