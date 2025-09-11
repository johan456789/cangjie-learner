function changeClass(node, command) {
	let operator = command.charAt(0),
		newClass = command.slice(1),
		oldClass = (node.className || '').split(' ');

	if (operator == '+') {
		oldClass.push(newClass);
		node.className = oldClass.join(' ');
	}
	else if (operator == '-') {
		let idx = oldClass.indexOf(newClass);
		while (idx !== -1) {
			oldClass.splice(idx, 1);
			idx = oldClass.indexOf(newClass);
		}
		node.className = oldClass.join(' ');
	}
	else node.className = command;
}

let keyboard = (function (){
	let keyboard = document.getElementById('keyboardMap');

	let key = {};

	let mapper = { ' ': ' ' };

	for (let i=0; i<3; i++) {
		let row = keyboard.children[i].children;

		for (let j=0, l=row.length; j<l; j++) {
			let alphabet = row[j].title;
			key[alphabet]  =  row[j];
			mapper[alphabet] = row[j].textContent;
		}
	}

	function press(keyName) {
		setTimeout(
			function(){ changeClass(key[keyName], "-press"); },
			150
		);

		changeClass(key[keyName], "+press");
	}

	function hint(keyName) {
		key.hint && changeClass(key[key.hint], "-hint");
		changeClass(key[keyName], "+hint");
		key.hint = keyName;
	}

	return {
		'press': press,
		'hint': hint,
		'mapper': mapper,
		'key': key
	};
})();

// Ensure global access for inline handlers
window.keyboard = keyboard;

// 字根類別資料集（字 + 代碼字母）
let RADICAL_POOLS = {
	'philosophy': ['日a','月b','金c','木d','水e','火f','土g'],
	'stroke': ['竹h','戈i','十j','大k','中l','一m','弓n'],
	'human': ['人o','心p','手q','口r'],
	'shape': ['尸s','廿t','山u','女v','田w','卜y']
};

// Add combined 'all' pool programmatically, preserving order by groups
RADICAL_POOLS.all = [].concat(
	RADICAL_POOLS.philosophy,
	RADICAL_POOLS.stroke,
	RADICAL_POOLS.human,
	RADICAL_POOLS.shape,
	'難x'
);

let questCheck = (function() {
	let characterTable =  document.getElementById("character");
	let defaultCharacterArray = characterTable.textContent.split('\n');
	let characterArray = defaultCharacterArray.slice();
	let questBar = document.getElementById('questAlphabet').children,
		nowCharacter;
	let isRadicalMode = false;
	let lastPickedCharacter = null;

	function pickRandomCharacter(){
		let start = 1;
		let end = characterArray.length - 2;
		let count = end - start + 1;
		let idx;
		if (count <= 0) return characterArray[0];
		if (isRadicalMode && count > 1 && lastPickedCharacter !== null) {
			do {
				idx = Math.floor(Math.random() * count) + start;
			} while (characterArray[idx] === lastPickedCharacter);
		} else {
			idx = Math.floor(Math.random() * count) + start;
		}
		lastPickedCharacter = characterArray[idx];
		return characterArray[idx];
	}

	function clearHint(){
		if (keyboard.key && keyboard.key.hint) {
			changeClass(keyboard.key[keyboard.key.hint], "-hint");
			keyboard.key.hint = null;
		}
	}

	function setQuestStatus(status){
		let qc = questBar[0];
		changeClass(qc, "-radical-wrong");
		if (status === 'wrong') changeClass(qc, "+radical-wrong");
	}

	function compare(string) {
		for (let i=0, l=nowCharacter.length; i<l; i++) {
			if (string.charAt(i) !== nowCharacter.charAt(i))
				return i;
		}
		return nowCharacter.length;
	}

	function indicate(index, wrong) {
		let l = nowCharacter.length;
		let i = 0;
		while (i<index) {
			changeClass(questBar[i+1], "right");
			i++;
		}

		let hintCharIndex = i;
		while (i<wrong) {
			changeClass(questBar[i+1], "wrong");
			i++;
		}
		changeClass(questBar[++i], "cursor");

		while (i<l) {
			changeClass(questBar[i+1], "");
			i++;
		}
		return hintCharIndex;
	}

	function setNewCharacter(characterString) {
		nowCharacter = characterString.slice(1);
		questBar[0].textContent = characterString.charAt(0);
		for (let i=1, l=questBar.length; i<l; i++) {
			if (isRadicalMode) {
				questBar[i].textContent = '';
			}
			else {
				questBar[i].textContent = keyboard.mapper[
					characterString.charAt(i) || ' '
				];
			}

			changeClass(questBar[i], "");
		}

		if (isRadicalMode) setQuestStatus('off');
	}

	setNewCharacter( pickRandomCharacter() );

	// Apply initial hint for the first character (單字模式)
	keyboard.hint(nowCharacter.charAt(indicate(0, 0)));

	function check(string) {
		let index = compare(string);

		if (index >= nowCharacter.length){
			setNewCharacter( pickRandomCharacter() );
			index = -1;
			string = '';

			// Apply hint for the new character's first key
			if (!isRadicalMode) {
				keyboard.hint(nowCharacter.charAt(indicate(0, 0)));
			} else {
				indicate(0, 0);
				clearHint();
			}
		}

		if (!isRadicalMode) {
			keyboard.hint( nowCharacter.charAt(
				indicate(index, string.length)
			));
		} else {
			// Radical mode: only keyboard highlight when wrong; no neutral/correct state
			if (string && string.length > index) {
				setQuestStatus('wrong');
				keyboard.hint(nowCharacter.charAt(0));
			} else if (!string) {
				setQuestStatus('off');
			}
		}

		return index == -1;
	}

	function setMode(newIsRadicalMode, categoryKey) {
		isRadicalMode = !!newIsRadicalMode;
		lastPickedCharacter = null;

		// Update the available character pool
		if (isRadicalMode) {
			let pool = RADICAL_POOLS[categoryKey] || RADICAL_POOLS.philosophy;
			characterArray = [''].concat(pool).concat(['']);
		} else {
			characterArray = defaultCharacterArray.slice();
		}

		// Toggle disabled state on keyboard keys based on radical pool
		(function updateDisabledKeys(){
			let allowed = {};
			if (isRadicalMode) {
				let selectedPool = RADICAL_POOLS[categoryKey] || RADICAL_POOLS.philosophy;
				for (let i = 0; i < selectedPool.length; i++) {
					let entry = selectedPool[i];
					let alpha = entry.charAt(entry.length - 1);
					allowed[alpha] = true;
				}
			}

			for (let alpha in keyboard.key) {
				if (!keyboard.key.hasOwnProperty(alpha)) continue;
				let node = keyboard.key[alpha];
				if (!node) continue;
				if (isRadicalMode) {
					if (allowed[alpha]) changeClass(node, "-disabled");
					else changeClass(node, "+disabled");
				} else {
					changeClass(node, "-disabled");
				}
			}
		})();

		setNewCharacter( pickRandomCharacter() );

		if (isRadicalMode) {
			setQuestStatus('off');
			clearHint();
		} else {
			keyboard.hint(nowCharacter.charAt(indicate(0, 0)));
		}
	}

	return { check: check, setMode: setMode, isRadical: function(){ return isRadicalMode; } };
})();

// Ensure global access for inline or external references
window.questCheck = questCheck;

document.getElementById('inputBar').oninput = function(){

	let string = this.value;
	if (/[^a-y]/.test(string)) {
		this.value = '';
		string = '';
	}

	let inRadical = questCheck.isRadical ? questCheck.isRadical() : false;

	string && keyboard.press(string.slice(-1));

	let isCompleted = questCheck.check ? questCheck.check(string) : questCheck(string);
	if (inRadical || isCompleted) this.value = '';
};

document.getElementById('inputBar').focus();
document.getElementById('inputBar').select();

// 模式/類別下拉初始化
(function(){
	let modeSelect = document.getElementById('modeSelect');
	let categorySelect = document.getElementById('categorySelect');
	if (!modeSelect || !categorySelect) return;

	function applyMode(){
		let isRoot = modeSelect.value === 'radical';
		categorySelect.disabled = !isRoot;
		let cat = categorySelect.value || 'philosophy';
		if (questCheck.setMode) questCheck.setMode(isRoot, cat);
		let input = document.getElementById('inputBar');
		if (input) input.value = '';
	}

	modeSelect.addEventListener('change', applyMode);
	categorySelect.addEventListener('change', applyMode);
	applyMode();
})();

document.addEventListener('DOMContentLoaded', () => {
  const toggleVisibilityBtn = document.getElementById('toggleVisibilityBtn');
  const keyboardMap = document.getElementById('keyboardMap');
  const toggleLayoutBtn = document.getElementById('toggleLayout');

  // Layout toggle state moved from inline HTML <script>
  let isEnglishLayout = false;
  let originalMapper = null;

  function ensureOriginalMapperSnapshot() {
    if (originalMapper) return;
    originalMapper = {};
    for (const alpha in keyboard.mapper) {
      if (Object.prototype.hasOwnProperty.call(keyboard.mapper, alpha)) {
        originalMapper[alpha] = keyboard.mapper[alpha];
      }
    }
  }

  function toggleLayout() {
    ensureOriginalMapperSnapshot();
    const keys = document.querySelectorAll('#keyboardMap span[title]');
    keys.forEach(key => {
      const alpha = key.title;
      const label = !isEnglishLayout
        ? alpha.toUpperCase()
        : (originalMapper.hasOwnProperty(alpha) ? originalMapper[alpha] : '');
      key.textContent = label;
    });
    isEnglishLayout = !isEnglishLayout;
    if (toggleLayoutBtn) toggleLayoutBtn.textContent = isEnglishLayout ? '倉頡鍵盤' : '英文鍵盤';
  }

  if (toggleLayoutBtn) {
    toggleLayoutBtn.addEventListener('click', toggleLayout);
  }

  if (toggleVisibilityBtn && keyboardMap) {
    const syncVisibilityState = () => {
      const isHidden = keyboardMap.classList.contains('hidden');
      toggleVisibilityBtn.textContent = isHidden ? '顯示鍵盤' : '隱藏鍵盤';
      if (toggleLayoutBtn) toggleLayoutBtn.disabled = isHidden;
    };

    // initialize state on load
    syncVisibilityState();

    toggleVisibilityBtn.addEventListener('click', () => {
      keyboardMap.classList.toggle('hidden');
      syncVisibilityState();
    });
  }
});
