import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const program = new Command();

program
  .name('aether')
  .description('Aether Index Developer CLI')
  .version('1.0.0');

/**
 * COMMAND: create-module
 * Scaffolds a new Aether Indexing module.
 */
program
  .command('create-module')
  .description('Scaffold a new Aether module')
  .argument('<name>', 'Name of the module (e.g., governance)')
  .action(async (name) => {
    const moduleName = name.startsWith('aether-') ? name : `aether-${name}`;
    const targetDir = path.join(process.cwd(), 'packages', moduleName);

    console.log(chalk.yellow(`\n🚀 Scaffolding ${moduleName}...`));

    if (fs.existsSync(targetDir)) {
      console.error(chalk.red(`Error: Directory ${targetDir} already exists.`));
      process.exit(1);
    }

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'description',
        message: 'Module description:',
        default: `Aether Indexing module for ${name}`
      },
      {
        type: 'confirm',
        name: 'includeTests',
        message: 'Include verification test suite?',
        default: true
      }
    ]);

    // Create directories
    fs.mkdirSync(path.join(targetDir, 'src'), { recursive: true });
    if (answers.includeTests) {
      fs.mkdirSync(path.join(targetDir, 'tests'), { recursive: true });
    }

    // package.json
    const pkgJson = {
      name: moduleName,
      version: "1.0.0",
      private: true,
      description: answers.description,
      main: "src/index.ts",
      dependencies: {
        "aether-shared": "*"
      }
    };
    fs.writeFileSync(path.join(targetDir, 'package.json'), JSON.stringify(pkgJson, null, 2));

    // src/index.ts
    const indexTs = `import { AetherModule } from 'aether-shared';

export class ${name.charAt(0).toUpperCase() + name.slice(1)}Module implements AetherModule {
  public id = "${moduleName}";
  public name = "Aether ${name.charAt(0).toUpperCase() + name.slice(1)}";
  public description = "${answers.description}";

  async initialize(db: any): Promise<void> {
    console.log("[${name}] Initializing...");
    // Create your tables here
  }

  async processTransaction(tx: any, db: any): Promise<void> {
    // Process your logic here
    console.log("[${name}] Processing transaction:", tx.signature.slice(0, 8));
  }
}
`;
    fs.writeFileSync(path.join(targetDir, 'src', 'index.ts'), indexTs);

    // README.md
    fs.writeFileSync(path.join(targetDir, 'README.md'), `# ${moduleName}\n\n${answers.description}`);

    console.log(chalk.green(`\n✅ Success! Module ${moduleName} created at packages/${moduleName}`));
    console.log(chalk.cyan(`\nNext steps:`));
    console.log(`1. Register the module in packages/aether-core/src/api/index.ts`);
    console.log(`2. Run 'npm install' at root to link the workspace.`);
  });

program.parse();
