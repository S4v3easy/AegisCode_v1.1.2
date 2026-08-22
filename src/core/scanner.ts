import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface DetectedStack {
    languages: string[];
    coreLibs: string[];
}

// 1. Define the Scanner interface
interface TechScanner {
    fileName: string;
    language: string;
    extractLibs: (content: string) => string[];
}

// 2. The Scanner Registry (Infinitely Scalable)
const scanners: TechScanner[] = [
    {
        fileName: 'package.json',
        language: 'JavaScript/TypeScript',
        extractLibs: (content) => {
            try {
                const pkg = JSON.parse(content);
                return [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})];
            } catch {
                return [];
            }
        }
    },
    {
        fileName: 'requirements.txt',
        language: 'Python',
        extractLibs: (content) => {
            // Split by line, ignore comments, split on '==' or '>=' to extract the clean package name
            return content.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0 && !line.startsWith('#'))
                .map(line => line.split(/[=<>~]/)[0].trim());
        }
    },
    {
        fileName: 'go.mod',
        language: 'Go',
        extractLibs: (content) => {
            // A go.mod file contains lines with the library and version.
            // We only extract lines that do not start with 'module' or 'go' and are not parentheses.
            return content.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0 && !line.startsWith('module') && !line.startsWith('go ') && line !== 'require (')
                // Extract the first word of the line (which in go.mod is always the library name)
                .map(line => line.split(' ')[0].trim());
        }
    },
    {
        fileName: 'composer.json',
        language: 'PHP',
        extractLibs: (content) => {
            try {
                const pkg = JSON.parse(content);
                return [...Object.keys(pkg.require || {}), ...Object.keys(pkg['require-dev'] || {})];
            } catch {
                return [];
            }
        }
    },
    {
        fileName: 'Cargo.toml',
        language: 'Rust',
        extractLibs: (content) => {
            let inDependencies = false;
            return content.split('\n')
                .map(line => line.trim())
                .filter(line => {
                    if (line.startsWith('[dependencies]') || line.startsWith('[dev-dependencies]')) {
                        inDependencies = true;
                        return false;
                    }
                    // Se inizia con '[' ma non è dependencies, smettiamo di raccogliere
                    if (line.startsWith('[')) {
                        inDependencies = false;
                        return false;
                    }
                    return inDependencies && line.includes('=') && !line.startsWith('#');
                })
                .map(line => line.split('=')[0].trim());
        }
    },
    {
        fileName: 'Gemfile',
        language: 'Ruby',
        extractLibs: (content) => {
            return content.split('\n')
                .map(line => line.trim())
                .filter(line => line.startsWith('gem ') && !line.startsWith('#'))
                .map(line => {
                    // Estrae il nome della gemma: gem 'rails', '~> 7.0' -> rails
                    const match = line.match(/gem\s+['"]([^'"]+)['"]/);
                    return match ? match[1] : '';
                })
                .filter(lib => lib.length > 0);
        }
    }
];

const extensionToLanguage: Record<string, string> = {
    '.py': 'Python',
    '.go': 'Go',
    '.js': 'JavaScript',
    '.ts': 'TypeScript',
    '.php': 'PHP',
    '.java': 'Java',
    '.rs': 'Rust',
    '.rb': 'Ruby',
    '.cs': 'C#'
};

//Function to find the main stack of the project and then pass it to the init command
export async function scanEnvironment(dirPath: string): Promise<DetectedStack> {
    let detectedLanguages: string[] = [];
    let detectedLibs: string[] = [];

    // --- MOTORE 1: Rilevamento Superficiale (Estensioni) ---
    try {
        const files = await fs.readdir(dirPath);
        for (const file of files) {
            const ext = path.extname(file);
            if (extensionToLanguage[ext]) {
                detectedLanguages.push(extensionToLanguage[ext]);
            }
        }
    } catch (err) {
        // Fallback silenzioso se non riesce a leggere la cartella
    }

    // --- MOTORE 2: Estrazione Chirurgica (Manifesti) ---
    // The engine loops finitely ONLY over registered scanners
    for (const scanner of scanners) {
        try {
            const filePath = path.join(dirPath, scanner.fileName);
            // If fs.readFile fails, the file does not exist, jump to catch
            const content = await fs.readFile(filePath, 'utf-8');
            
            // File found! Extract libraries
            const libs = scanner.extractLibs(content);
            
            detectedLanguages.push(scanner.language);
            detectedLibs.push(...libs);
        } catch (err) {
            // The file does not exist, simply move to the next scanner
            continue; 
        }
    }

    // Remove any duplicates
    return {
        languages: [...new Set(detectedLanguages)],
        coreLibs: [...new Set(detectedLibs)]
    };
}