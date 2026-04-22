import { Command, Flags, ux } from '@oclif/core';
import fs from 'fs-extra';
import path from 'path';
import inquirer from 'inquirer';
import kleur from 'kleur';
import { execSync } from 'child_process';

export default class Init extends Command {
    static description = 'Initialize a new @aurora-mp project from a platform template. (WIP)';

    static flags = {
        template: Flags.string({
            char: 't',
            description: 'Which platform template to use',
            options: ['ragemp'] as const,
            default: 'ragemp',
        }),
    };

    public async run(): Promise<void> {
        const { flags } = await this.parse(Init);
        const { template } = flags;
        const templatesDir = path.join(__dirname, '..', '..', 'templates');

        // Prompt for project name
        const { projectName } = await inquirer.prompt<{ projectName: string }>([
            {
                type: 'input',
                name: 'projectName',
                message: 'Project name:',
                default: `my-${template}-app`,
                validate: (i) => (i.trim().length > 0 ? true : 'Name cannot be empty'),
            },
        ]);

        // Prompt for destination directory
        const { destination } = await inquirer.prompt<{ destination: string }>([
            {
                type: 'input',
                name: 'destination',
                message: 'Destination directory:',
                default: projectName,
                validate: (i) => (i.trim().length > 0 ? true : 'Directory cannot be empty'),
            },
        ]);

        // Prompt for package manager
        const { packageManager } = await inquirer.prompt<{ packageManager: 'npm' | 'yarn' | 'pnpm' }>([
            {
                type: 'list',
                name: 'packageManager',
                message: 'Which package manager would you like to use?',
                choices: ['npm', 'yarn', 'pnpm'],
                default: 'npm',
            },
        ]);

        // Confirm creation
        this.log();
        const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
            {
                type: 'confirm',
                name: 'confirm',
                message: `Create project "${projectName}" in "${destination}" using ${packageManager}?`,
                default: true,
            },
        ]);

        if (!confirm) {
            this.log(kleur.yellow('Project creation aborted.'));
            return;
        }

        // Copy template
        const source = path.join(templatesDir, template);
        const target = path.resolve(process.cwd(), destination);
        if (!fs.existsSync(source)) {
            this.error(`Template "${template}" not found at ${source}`);
        }
        ux.action.start(`Generating project in ${target}`);
        await fs.copy(source, target, { overwrite: false, errorOnExist: true });
        ux.action.stop();
        this.log(kleur.green(`\n✔ Project "${projectName}" created at ${target}\n`));

        // Update package.json name & workspaces configuration
        const pkgPath = path.join(target, 'package.json');
        const pkg = await fs.readJson(pkgPath);
        pkg.name = projectName;

        if (packageManager === 'pnpm') {
            // write pnpm-workspace.yaml
            const workspaceYaml = `packages:\n  - 'packages/*'\n`;
            await fs.writeFile(path.join(target, 'pnpm-workspace.yaml'), workspaceYaml);
            // remove any workspaces field from package.json
            delete pkg.workspaces;
        } else {
            // for npm or yarn, use workspaces field in package.json
            pkg.workspaces = ['packages/*'];
            // remove pnpm-workspace.yaml if it exists
            await fs.remove(path.join(target, 'pnpm-workspace.yaml'));
        }

        await fs.writeJson(pkgPath, pkg, { spaces: 2 });

        // Offer to install dependencies
        const { installDeps } = await inquirer.prompt<{ installDeps: boolean }>([
            {
                type: 'confirm',
                name: 'installDeps',
                message: 'Install dependencies now?',
                default: false,
            },
        ]);

        if (installDeps) {
            this.log(`\nInstalling dependencies with ${packageManager}...`);
            try {
                execSync(`${packageManager} install`, { cwd: target, stdio: 'inherit' });
                this.log(kleur.green('\nDependencies installed.\n'));
            } catch {
                this.log(kleur.red('\nInstallation failed. Please run manually inside the project.\n'));
            }
        }

        // Final instructions
        this.log(`Next steps: \n\n${kleur.cyan(`cd ${destination}`)}`);

        if (installDeps) {
            this.log(`\n${kleur.cyan(`${packageManager} run dev`)}`);
        } else {
            this.log(`\n${kleur.cyan(`${packageManager} install`)}`);
            this.log(`${kleur.cyan(`${packageManager} run dev`)}`);
        }
    }
}
