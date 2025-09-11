
function changeClass(node, command) {
	var operator = command.charAt(0),
		newClass = command.slice(1),
		oldClass = (node.className || '').split(' ');

	if (operator == '+') {
		oldClass.push(newClass);
		node.className = oldClass.join(' ');
	}
	else if (operator == '-') {
		var idx = oldClass.indexOf(newClass);
		while (idx !== -1) {
			oldClass.splice(idx, 1);
			idx = oldClass.indexOf(newClass);
		}
		node.className = oldClass.join(' ');
	}
	else node.className = command;
}

var keyboard = (function (){
	var keyboard = document.getElementById('keyboardMap');

	var key = {};

	var mapper = { ' ': ' ' };

	for (var i=0; i<3; i++) {
		var row = keyboard.children[i].children;

		for (var j=0, l=row.length; j<l; j++) {
			var alphabet = row[j].title;
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

// 字根類別資料集（字 + 代碼字母）
var RADICAL_POOLS = {
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


var questCheck = (function() {
	var characterTable =  document.getElementById("character");
	var defaultCharacterArray = characterTable.textContent.split('\n');
	var characterArray = defaultCharacterArray.slice();
	var questBar = document.getElementById('questAlphabet').children,
		nowCharacter;
	var isRadicalMode = false;
	var lastPickedCharacter = null;

	function pickRandomCharacter(){
		var start = 1;
		var end = characterArray.length - 2;
		var count = end - start + 1;
		var idx;
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
		var qc = questBar[0];
		changeClass(qc, "-radical-wrong");
		if (status === 'wrong') changeClass(qc, "+radical-wrong");
	}

	function compare(string) {
		for (var i=0, l=nowCharacter.length; i<l; i++) {
			if (string.charAt(i) !== nowCharacter.charAt(i)) break;
		}
		return i;
	}

	function indicate(index, wrong) {
		var l = nowCharacter.length;
		for (var i=0; i<index; i++) {
			changeClass(questBar[i+1], "right");
		}

		var hintCharIndex = i;
		for (; i<wrong; i++) changeClass(questBar[i+1], "wrong");
		changeClass(questBar[++i], "cursor");

		for (; i<l; i++) changeClass(questBar[i+1], "");
		return hintCharIndex;
	}

	function setNewCharacter(characterString) {
		nowCharacter = characterString.slice(1);
		questBar[0].textContent = characterString.charAt(0);
		for (var i=1, l=questBar.length; i<l; i++) {
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
		var index = compare(string);

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
			var pool = RADICAL_POOLS[categoryKey] || RADICAL_POOLS.philosophy;
			characterArray = [''].concat(pool).concat(['']);
		} else {
			characterArray = defaultCharacterArray.slice();
		}

		// Toggle disabled state on keyboard keys based on radical pool
		(function updateDisabledKeys(){
			var allowed = {};
			if (isRadicalMode) {
				var selectedPool = RADICAL_POOLS[categoryKey] || RADICAL_POOLS.philosophy;
				for (var i = 0; i < selectedPool.length; i++) {
					var entry = selectedPool[i];
					var alpha = entry.charAt(entry.length - 1);
					allowed[alpha] = true;
				}
			}

			for (var alpha in keyboard.key) {
				if (!keyboard.key.hasOwnProperty(alpha)) continue;
				var node = keyboard.key[alpha];
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

document.getElementById('inputBar').oninput = function(){

	var string = this.value;
	if (/[^a-y]/.test(string)) {
		this.value = '';
		string = '';
	}

	var inRadical = questCheck.isRadical ? questCheck.isRadical() : false;

	string && keyboard.press(string.slice(-1));

	var isCompleted = questCheck.check ? questCheck.check(string) : questCheck(string);
	if (inRadical || isCompleted) this.value = '';
};

document.getElementById('inputBar').focus();
document.getElementById('inputBar').select();

// 模式/類別下拉初始化
(function(){
	var modeSelect = document.getElementById('modeSelect');
	var categorySelect = document.getElementById('categorySelect');
	if (!modeSelect || !categorySelect) return;

	function applyMode(){
		var isRoot = modeSelect.value === 'radical';
		categorySelect.disabled = !isRoot;
		var cat = categorySelect.value || 'philosophy';
		if (questCheck.setMode) questCheck.setMode(isRoot, cat);
		var input = document.getElementById('inputBar');
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
