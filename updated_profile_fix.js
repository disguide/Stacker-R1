const fs = require('fs');
const path = require('path');
const targetPath = 'app/profile.tsx';
const absolutePath = path.resolve(process.cwd(), targetPath);

if (!fs.existsSync(absolutePath)) {
    console.error(`File not found: ${absolutePath}`);
    process.exit(1);
}

let data = fs.readFileSync(absolutePath, 'utf8');
const originalData = data;

// 1. Update Styles
const styleOld = /inlineInput: \{[^}]*flex: 1,[^}]*\},/s;
const styleNew = `inlineInput: {
        fontSize: 16,
        color: '#1E293B',
        minHeight: 24,
        paddingTop: 0,
    },
    inlineContentWrapper: {
        flex: 1,
        flexDirection: 'column',
    },`;

data = data.replace(styleOld, styleNew);

const tagStyleOld = /tagWrapper: \{[^}]*marginRight: 10,[^}]*\},/s;
const tagStyleNew = `tagWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },`;

data = data.replace(tagStyleOld, tagStyleNew);

// 2. Update Goal JSX
const goalBlockOld = /(!isEditing && \(.*?<View style=\{styles\.tagWrapper\}>.*?<\/View>.*?<\/View>.*?<TextInput.*?placeholder="Enter Goal\.\.\.".*?placeholderTextColor="#94A3B8".*?\/>)/s;
// This regex is too brittle. Let's use a simpler string replacement for the patterns.

function replaceGoalStructure(content, type) {
    const isGoal = type === 'goals';
    const tagColor = isGoal ? '#3B82F6' : '#EC4899';
    const tagLabel = isGoal ? 'GOAL' : 'ANTI-GOAL';
    const tabName = isGoal ? 'goals' : 'antigoals';
    const placeholder = isGoal ? 'Enter Goal...' : 'Enter Anti-Goal...';

    const oldPattern = `                                            {!isEditing && (
                                                <View style={styles.tagWrapper}>
                                                    <View style={[styles.listCategoryTag, { backgroundColor: (item.color || '${tagColor}') + '15' }]}>
                                                        <Text style={[styles.listCategoryTagText, { color: item.color || '${tagColor}' }]}>
                                                            {item.category ? item.category.toUpperCase() : '${tagLabel}'}
                                                        </Text>
                                                    </View>
                                                </View>
                                            )}

                                            <TextInput
                                                style={styles.inlineInput}
                                                value={item.title}
                                                onChangeText={(t) => updateGoalItem(item.id, t)}
                                                onFocus={(e) => {
                                                    setActiveTab('${tabName}');
                                                    if (!isEditing) handleEditToggle();
                                                    e.target.measure((x, y, width, height, pageX, pageY) => {
                                                        handleFieldFocus(pageY);
                                                    });
                                                }}
                                                placeholder="${placeholder}"
                                                placeholderTextColor="#94A3B8"
                                            />`;

    const newPattern = `                                            <View style={styles.inlineContentWrapper}>
                                                <TextInput
                                                    style={styles.inlineInput}
                                                    value={item.title}
                                                    onChangeText={(t) => updateGoalItem(item.id, t)}
                                                    onFocus={(e) => {
                                                        setActiveTab('${tabName}');
                                                        if (!isEditing) handleEditToggle();
                                                        e.target.measure((x, y, width, height, pageX, pageY) => {
                                                            handleFieldFocus(pageY);
                                                        });
                                                    }}
                                                    placeholder="${placeholder}"
                                                    placeholderTextColor="#94A3B8"
                                                />

                                                {!isEditing && (
                                                    <View style={styles.tagWrapper}>
                                                        <View style={[styles.listCategoryTag, { backgroundColor: (item.color || '${tagColor}') + '15' }]}>
                                                            <Text style={[styles.listCategoryTagText, { color: item.color || '${tagColor}' }]}>
                                                                {item.category ? item.category.toUpperCase() : '${tagLabel}'}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                )}
                                            </View>`;

    // Normalize whitespace for fuzzy match if needed, but here we try exact string first after splitting into lines to avoid \r issue
    const lines = content.split(/\r?\n/);
    const oldLines = oldPattern.split(/\r?\n/);
    const newLines = newPattern.split(/\r?\n/);

    for (let i = 0; i <= lines.length - oldLines.length; i++) {
        let match = true;
        for (let j = 0; j < oldLines.length; j++) {
            if (lines[i+j].trim() !== oldLines[j].trim()) {
                match = false;
                break;
            }
        }
        if (match) {
            lines.splice(i, oldLines.length, ...newLines);
            return lines.join('\n');
        }
    }
    console.warn(`Pattern for ${type} NOT found!`);
    return content;
}

data = replaceGoalStructure(data, 'goals');
data = replaceGoalStructure(data, 'anti-goals');

if (data !== originalData) {
    fs.writeFileSync(absolutePath, data);
    console.log('Successfully updated profile.tsx');
} else {
    console.error('No changes were made - matching failed.');
    process.exit(1);
}
