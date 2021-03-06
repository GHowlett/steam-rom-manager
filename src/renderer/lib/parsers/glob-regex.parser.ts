import { Parser, GenericParser, UserConfiguration, ParsedData } from '../../models';
import { escapeRegExp } from "lodash";
import * as glob from 'glob';
import * as path from 'path';

interface TitleTagData {
    direction: 'left' | 'right',
    level: number,
    finalGlob: string,
    leftovers: { left: string, right: string },
    regex: RegExp
}

export class GlobRegexParser implements GenericParser {
    getParser(): Parser {
        return {
            title: 'Glob-Regex',
            info: `
                <div class="paragraph">
                    Extracts title from a path. Directories/files are matched using <span class="code">glob</span> pattern (uses node-glob). 
                    Parser tries to extract title from a path segment (which are separated by path separators) containing 
                    <span class="code">\${"regex"}</span>. A custom, user defined regular expression is then used to extract titles more 
                    precisely given multiple directory/file patterns. For example, consider that we have:
                    <ul>
                        <li><span class="code">glob</span>: <span class="code">**/\${/(.+?)\\s*\\[|(.+)/}/*/*.fml</span></li>
                        <li><span class="code">filePath1</span>: <span class="code">Dir1\\Dir2\\Roses are red\\Dir3\\myfile.fml</span></li>
                        <li><span class="code">filePath2</span>: <span class="code">Dir1\\Dir2\\Roses are red [or green]\\Dir3\\myfile.fml</span></li>
                    </ul>
                    It will match <span class="code">\${"regex"}</span> with <span class="code">Roses are red</span> and <span class="code">Roses are red [or green]</span>. 
                    Then it will use "regex" to determinate title. <span class="code">(.+?)\\s*\\[</span> will "hit" nothing in <span class="code">filePath1</span> and
                    <span class="code">(.+)</span> will be used next to capture everything. <span class="code">(.+?)\\s*\\[</span> will match <span class="code">filePath2</span>
                    and will be considered as title (other regex parts will be ignored - "First-come, first-served"). Thus extracting <span class="code">Roses are red</span> from
                    both file paths. Furthermore, extracted title has whitespaces trimmed off.
                </div>
                <div class="paragraph">
                    Regex capture pairs (different pairs are seperated with <span class="code">|</span>) will have their contents joined. For example:
                    <span class="code">(.+)\\s\\[.+?\\](\\s.*)</span> in <span class="code">Roses are red [skip this] or green</span> will match:
                    <ul>
                        <li><span class="code">Roses are red</span></li>
                        <li><span class="code">&nbsp;or green</span></li>
                    </ul>
                    The final result will be <span class="code">Roses are red or green</span>.
                </div>
                <div class="paragraph">
                    This parser should be used when title containing path segment has more than one pattern (see "User\'s glob-regex" below for examples).
                    I recommend using <span class="code">https://regex101.com/</span> to test your regular expression (select "javascript" option). 
                </div>
            `,
            inputs: {
                'glob-regex': {
                    label: 'User\'s glob-regex',
                    validationFn: this.validate.bind(this),
                    info: `
                        <div class="paragraph">
                            Glob containing <span class="code">\${"regex"}</span> which is later replaced with a star <span class="code">*</span> or globstar <span class="code">**</span> 
                            if there are no path separators. It can have multiple capture brackets and first one to capture something is interpreted as a title. Below are few examples of 
                            how parser extracts title from <span class="code">C:\\ROMS\\Roses are red [AEF123] 7\\myfile.fml</span> and <span class="code">C:\\ROMS\\Roses are green\\myfile.fml</span>:
                        </div>
                        <div class="paragraph">
                            <span class="code">\${/.*/}</span> (4 entries: 4 successful, 0 failed)
                            <ul style="margin: 0.25em 0">
                                <li>Roses are green</li>
                                <li>Roses are green\\myfile.fml</li>
                                <li>Roses are red [AEF123] 7</li>
                                <li>Roses are red [AEF123] 7\\myfile.fml</li>
                            </ul>
                            <span class="code">\${/.+\\//}</span> (4 entries: 2 successful, 2 failed)
                            <ul style="margin: 0.25em 0">
                                <li>Roses are green</li>
                                <li>Roses are red [AEF123] 7</li>
                            </ul>
                            <span class="code">\${/.+/}/*</span> (2 entries: 2 successful, 0 failed)
                            <ul style="margin: 0.25em 0">
                                <li>Roses are green</li>
                                <li>Roses are red [AEF123] 7</li>
                            </ul>
                            <span class="code">\${/(.+?)\\s*\\[|(.+)/}/*</span> (2 entries: 2 successful, 0 failed)
                            <ul style="margin: 0.25em 0">
                                <li>Roses are green</li>
                                <li>Roses are red</li>
                            </ul>
                        </div>
                    `
                }
            }
        };
    }

    private validate(fileGlob: string) {
        let testRegExpr = /\${\/(.+)\/([ui]*?)}/gi;
        let match = testRegExpr.exec(fileGlob);
        if (match === null)
            return 'File glob must contain ${regex} where "regex" is your regular expresion!';
        else if (match.length > 3)
            return 'File glob must contain only one ${regex}!';

        testRegExpr = /.*\*\${.+}.*|.*\${.+}\*.*/i;
        match = testRegExpr.exec(fileGlob);
        if (match !== null)
            return 'Star (*) can not be next to ${regex}!';

        testRegExpr = /\\/i;
        match = testRegExpr.exec(fileGlob.replace(/(\${.+})/i, ''));
        if (match !== null)
            return 'Windows directory character (\\) is not alowed! Use "/" instead.';

        testRegExpr = /.*\*\*.+\${.+}.+\*\*.*/i;
        match = testRegExpr.exec(fileGlob);
        if (match !== null)
            return 'Globstar (**) can only be on one side of ${regex}!';

        return null;
    }

    private getTitleDepth(fileGlob: string) {
        let depth: { direction: 'left' | 'right', level: number } = { direction: undefined, level: undefined };
        let tempGlob = undefined;
        if (fileGlob.replace(/\${.+}/i, '').length === 0) {
            depth.level = null;
        }
        else if (/.*\*\*.+\${.+}.*/i.test(fileGlob)) {
            depth.direction = 'right';
            tempGlob = fileGlob.replace(/.*\${.+}/i, '');
        }
        else {
            depth.direction = 'left';
            tempGlob = fileGlob.replace(/\${.+}.*/i, '');
        }

        if (depth.level === undefined) {
            let dirMatch = tempGlob.match(/\//g);
            depth.level = dirMatch === null ? 0 : dirMatch.length;
        }

        return depth;
    }

    private getTitleLeftovers(fileGlob: string) {
        let leftovers: { left: string, right: string } = { left: '', right: '' };
        let titleSegmentMatch = fileGlob.match(/.*\/(.*\${.+}.*?)\/|.*\/(.*\${.+}.*)|(.*\${.+}.*?)\/|(.*\${.+}.*)/i);
        if (titleSegmentMatch !== null) {
            let titleSegments = (titleSegmentMatch[1] || titleSegmentMatch[2] || titleSegmentMatch[3] || titleSegmentMatch[4]).replace(/\${.*}/, '${}').split('*');
            for (var i = 0; i < titleSegments.length; i++) {
                if (titleSegments[i].search(/\${}/i) !== -1) {
                    let leftoverSegments = titleSegments[i].split(/\${}/i);
                    leftovers.left = leftoverSegments[0] !== undefined ? leftoverSegments[0] : '';
                    leftovers.right = leftoverSegments[1] !== undefined ? leftoverSegments[1] : '';
                    break;
                }
            }
        }
        return leftovers;
    }

    private getFinalGlob(fileGlob: string, depth: { direction: 'left' | 'right', level: number }) {
        if (depth.level !== null) {
            return fileGlob.replace(/(\${.+})/i, '*')
        }
        else
            return '**';
    }

    private makeRegex(fileGlob: string) {
        let match = /\${\/(.+)\/(.*?)}/.exec(fileGlob);
        if (match) {
            return new RegExp(match[1], match[2] ? match[2] : '');
        }
        else
            return new RegExp('');
    }

    private extractTitleTag(fileGlob: string) {
        let extractedData: TitleTagData = { direction: undefined, level: undefined, finalGlob: undefined, regex: undefined, leftovers: { left: undefined, right: undefined } };
        let depth = this.getTitleDepth(fileGlob);
        let leftovers = this.getTitleLeftovers(fileGlob);
        extractedData.direction = depth.direction;
        extractedData.level = depth.level;
        extractedData.leftovers.left = leftovers.left ? '.*' + escapeRegExp(leftovers.left) : '';
        extractedData.leftovers.right = leftovers.right ? escapeRegExp(leftovers.right) + '.*' : '';
        extractedData.finalGlob = this.getFinalGlob(fileGlob, depth);
        extractedData.regex = this.makeRegex(fileGlob);
        return extractedData;
    }

    private extractTitle(titleData: TitleTagData, file: string) {
        if (titleData.level !== null) {
            let fileSections = file.split('/');
            file = fileSections[titleData.direction === 'right' ? fileSections.length - (titleData.level + 1) : titleData.level];
        }
        let titleRegExp = new RegExp(titleData.leftovers.left + '(.+)' + titleData.leftovers.right);
        let titleMatch = file.match(titleRegExp);
        if (titleMatch !== null) {
            titleMatch = titleMatch[1].match(titleData.regex);
            if (titleMatch !== null) {
                let title: string = '';
                for (let i = 1; i < titleMatch.length; i++) {
                    if (titleMatch[i])
                        title += titleMatch[i];
                }
                if (title.length === 0)
                    return titleMatch[0].replace(/\//g, path.sep).trim();
                else
                    return title.replace(/\//g, path.sep).trim();
            }
        }
        return undefined;
    }

    private extractTitles(titleData: TitleTagData, directory: string, files: string[]) {
        let parsedData: ParsedData = { success: [], failed: [] };
        for (let i = 0; i < files.length; i++) {
            let title = this.extractTitle(titleData, files[i]);
            let filepath = files[i].replace(/\\|\//g, path.sep);
            if (title !== undefined)
                parsedData.success.push({ filePath: path.join(directory, filepath), extractedTitle: title });
            else
                parsedData.failed.push(path.join(directory, filepath));
        }
        return parsedData;
    }

    execute(config: UserConfiguration) {
        return new Promise<ParsedData>((resolve, reject) => {
            if (this.validate(config.parserInputs['glob-regex']) === null) {
                let titleData = this.extractTitleTag(config.parserInputs['glob-regex']);
                glob(titleData.finalGlob, { silent: true, dot: true, cwd: config.romDirectory }, (err, files) => {
                    if (err)
                        reject(err);
                    else
                        resolve(this.extractTitles(titleData, config.romDirectory, files));
                });
            }
            else
                reject('Invalid "glob-regex" input!');
        });
    }
}