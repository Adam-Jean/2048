function HTMLActuator() {
  this.tileContainer    = document.querySelector(".tile-container");
  this.scoreContainer   = document.querySelector(".score-container");
  this.bestContainer    = document.querySelector(".best-container");
  this.messageContainer = document.querySelector(".game-message");
  this.gameContainer    = document.querySelector(".game-container");
  this.effectsContainer = document.querySelector(".effects-container");

  this.score = 0;
}

HTMLActuator.prototype.actuate = function (grid, metadata) {
  var self = this;

  window.requestAnimationFrame(function () {
    self.clearContainer(self.tileContainer);
    self.merges = [];

    grid.cells.forEach(function (column) {
      column.forEach(function (cell) {
        if (cell) {
          self.addTile(cell);
        }
      });
    });

    self.playMergeEffects(self.merges);

    self.updateScore(metadata.score);
    self.updateBestScore(metadata.bestScore);

    if (metadata.terminated) {
      if (metadata.over) {
        self.message(false); // You lose
      } else if (metadata.won) {
        self.message(true); // You win!
      }
    }

  });
};

// Continues the game (both restart and keep playing)
HTMLActuator.prototype.continueGame = function () {
  this.clearMessage();
};

HTMLActuator.prototype.clearContainer = function (container) {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
};

HTMLActuator.prototype.addTile = function (tile) {
  var self = this;

  var wrapper   = document.createElement("div");
  var inner     = document.createElement("div");
  var position  = tile.previousPosition || { x: tile.x, y: tile.y };
  var positionClass = this.positionClass(position);

  // We can't use classlist because it somehow glitches when replacing classes
  var classes = ["tile", "tile-" + tile.value, positionClass];

  if (tile.value > 2048) classes.push("tile-super");

  this.applyClasses(wrapper, classes);

  var label = this.chineseNumeral(tile.value);

  inner.classList.add("tile-inner");
  inner.classList.add("tile-label");
  inner.classList.add("chars-" + Math.min(label.length, 9));
  inner.textContent = label;

  if (tile.previousPosition) {
    // Make sure that the tile gets rendered in the previous position first
    window.requestAnimationFrame(function () {
      classes[2] = self.positionClass({ x: tile.x, y: tile.y });
      self.applyClasses(wrapper, classes); // Update the position
    });
  } else if (tile.mergedFrom) {
    classes.push("tile-merged");
    this.applyClasses(wrapper, classes);

    // Render the tiles that merged
    tile.mergedFrom.forEach(function (merged) {
      self.addTile(merged);
    });
  } else {
    classes.push("tile-new");
    this.applyClasses(wrapper, classes);
  }

  // Add the inner part of the tile to the wrapper
  wrapper.appendChild(inner);

  // Put the tile on the board
  this.tileContainer.appendChild(wrapper);

  if (tile.mergedFrom && this.merges) {
    this.merges.push({
      tile:  tile,
      color: window.getComputedStyle(inner).backgroundColor
    });
  }
};

// Merge effects: explosions, board shake and device vibration
HTMLActuator.prototype.playMergeEffects = function (merges) {
  var self = this;

  if (!merges.length) return;
  if (window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var biggest = 0;
  merges.forEach(function (merge) {
    biggest = Math.max(biggest, merge.tile.value);
  });

  // Wait for the tiles to slide into place before blowing up
  window.setTimeout(function () {
    merges.forEach(function (merge) {
      self.explode(merge.tile, merge.color);
    });
    self.shake(biggest, merges.length);
    self.vibrate(biggest, merges.length);
  }, 100);
};

HTMLActuator.prototype.explode = function (tile, color) {
  if (!this.effectsContainer) return;

  var burst = document.createElement("div");
  this.applyClasses(burst, ["tile", "merge-burst",
                            this.positionClass({ x: tile.x, y: tile.y })]);
  this.effectsContainer.appendChild(burst);

  if (!burst.animate) {
    this.effectsContainer.removeChild(burst);
    return;
  }

  var power    = Math.log(tile.value) / Math.LN2;
  var level    = Math.min(power / 11, 1.5);
  var tileSize = burst.offsetWidth;
  var lifetime = 350;

  // Bright flash over the merged tile
  var flash = document.createElement("div");
  flash.classList.add("merge-flash");
  flash.style.background = color;
  burst.appendChild(flash);
  flash.animate([
    { transform: "scale(1)", opacity: 0.9, filter: "brightness(2)" },
    { transform: "scale(" + (1.6 + level * 0.6) + ")", opacity: 0,
      filter: "brightness(1)" }
  ], { duration: 350, easing: "ease-out" });

  // Expanding shockwave rings
  var rings = tile.value >= 256 ? 2 : 1;
  for (var r = 0; r < rings; r++) {
    var ring = document.createElement("div");
    ring.classList.add("merge-ring");
    ring.style.borderColor = color;
    burst.appendChild(ring);
    ring.animate([
      { transform: "scale(0.4)", opacity: 1 },
      { transform: "scale(" + (2.2 + level * 1.5 + r) + ")", opacity: 0 }
    ], { duration: 450 + r * 150, delay: r * 90, easing: "ease-out",
         fill: "backwards" });
    lifetime = Math.max(lifetime, 450 + r * 240);
  }

  // Debris flying out in every direction
  var count = Math.min(10 + power * 2, 40);
  for (var i = 0; i < count; i++) {
    var particle = document.createElement("div");
    var size     = 4 + Math.random() * (5 + level * 6);
    var angle    = Math.random() * Math.PI * 2;
    var distance = tileSize * (0.6 + Math.random() * 0.8) * (1 + level * 0.6);
    var dx       = Math.cos(angle) * distance;
    var dy       = Math.sin(angle) * distance;
    var fall     = tileSize * 0.3 * Math.random();
    var spin     = (Math.random() - 0.5) * 720;
    var duration = 500 + Math.random() * 350;

    particle.classList.add("merge-particle");
    particle.style.width      = size + "px";
    particle.style.height     = size + "px";
    particle.style.marginLeft = -size / 2 + "px";
    particle.style.marginTop  = -size / 2 + "px";
    particle.style.background = Math.random() < 0.3 ? "#fff7d6" : color;
    burst.appendChild(particle);

    particle.animate([
      { transform: "translate(0, 0) rotate(0deg) scale(1)", opacity: 1 },
      { transform: "translate(" + dx * 0.85 + "px, " + dy * 0.85 + "px) " +
                   "rotate(" + spin * 0.7 + "deg) scale(0.9)",
        opacity: 1, offset: 0.55 },
      { transform: "translate(" + dx + "px, " + (dy + fall) + "px) " +
                   "rotate(" + spin + "deg) scale(0)", opacity: 0 }
    ], { duration: duration, easing: "cubic-bezier(0.15, 0.7, 0.3, 1)" });

    lifetime = Math.max(lifetime, duration);
  }

  var container = this.effectsContainer;
  window.setTimeout(function () {
    if (burst.parentNode === container) container.removeChild(burst);
  }, lifetime + 50);
};

HTMLActuator.prototype.shake = function (value, mergeCount) {
  if (!this.gameContainer || !this.gameContainer.animate) return;

  var power     = Math.log(value) / Math.LN2;
  var amplitude = Math.min(2 + power * 1.2 + (mergeCount - 1) * 1.5, 24);
  var tilt      = power >= 7 ? Math.min(power - 6, 4) * 0.6 : 0;
  var steps     = 8;
  var frames    = [];

  for (var i = 0; i < steps; i++) {
    var decay = 1 - i / steps;
    frames.push({
      transform: "translate(" +
        (Math.random() * 2 - 1) * amplitude * decay + "px, " +
        (Math.random() * 2 - 1) * amplitude * decay + "px) " +
        "rotate(" + (Math.random() * 2 - 1) * tilt * decay + "deg)"
    });
  }
  frames.push({ transform: "translate(0, 0) rotate(0deg)" });

  if (this.shakeAnimation) this.shakeAnimation.cancel();
  this.shakeAnimation = this.gameContainer.animate(frames, {
    duration: 250 + power * 20,
    easing: "ease-out"
  });
};

HTMLActuator.prototype.vibrate = function (value, mergeCount) {
  if (!navigator.vibrate) return;

  var power = Math.log(value) / Math.LN2;
  var pattern;

  if (value >= 2048) {
    pattern = [200, 60, 120, 60, 300];
  } else if (power >= 7) {
    pattern = [40 + power * 6, 30, 30 + power * 4];
  } else {
    pattern = [20 + power * 5 + (mergeCount - 1) * 10];
  }

  try {
    navigator.vibrate(pattern);
  } catch (e) {
    // Vibration may be blocked until the user has interacted with the page
  }
};

HTMLActuator.prototype.applyClasses = function (element, classes) {
  element.setAttribute("class", classes.join(" "));
};

HTMLActuator.prototype.normalizePosition = function (position) {
  return { x: position.x + 1, y: position.y + 1 };
};

HTMLActuator.prototype.positionClass = function (position) {
  position = this.normalizePosition(position);
  return "tile-position-" + position.x + "-" + position.y;
};

HTMLActuator.prototype.updateScore = function (score) {
  this.clearContainer(this.scoreContainer);

  var difference = score - this.score;
  this.score = score;

  this.scoreContainer.textContent = this.chineseDigits(this.score);

  if (difference > 0) {
    var addition = document.createElement("div");
    addition.classList.add("score-addition");
    addition.textContent = "+" + this.chineseDigits(difference);

    this.scoreContainer.appendChild(addition);
  }
};

HTMLActuator.prototype.updateBestScore = function (bestScore) {
  this.bestContainer.textContent = this.chineseDigits(bestScore);
};

// Full Chinese numeral for tile values, e.g. 2048 -> 二千零四十八
HTMLActuator.prototype.chineseNumeral = function (value) {
  var digits   = "零一二三四五六七八九";
  var units    = ["", "十", "百", "千"];
  var bigUnits = ["", "万", "亿"];

  if (value === 0) return digits.charAt(0);

  // Writes a number below 10000, with 零 standing in for skipped places
  function section(number) {
    var text = "";
    var zero = false;

    for (var place = 3; place >= 0; place--) {
      var digit = Math.floor(number / Math.pow(10, place)) % 10;

      if (digit === 0) {
        if (text) zero = true;
      } else {
        if (zero) text += digits.charAt(0);
        text += digits.charAt(digit) + units[place];
        zero = false;
      }
    }

    return text;
  }

  var groups = [];
  while (value > 0) {
    groups.unshift(value % 10000);
    value = Math.floor(value / 10000);
  }

  var result   = "";
  var skipped  = false;
  var bigIndex = groups.length - 1;

  groups.forEach(function (group, index) {
    if (group === 0) {
      skipped = true;
    } else {
      if (result && (skipped || group < 1000)) result += digits.charAt(0);
      result += section(group) + bigUnits[bigIndex - index];
      skipped = false;
    }
  });

  // 10-19 are written 十, 十一 ... rather than 一十, 一十一 ...
  if (result.indexOf("一十") === 0) result = result.slice(1);

  return result;
};

// Compact digit-by-digit form for scores, e.g. 2048 -> 二〇四八
HTMLActuator.prototype.chineseDigits = function (value) {
  var digits = "〇一二三四五六七八九";

  return String(value).replace(/\d/g, function (digit) {
    return digits.charAt(+digit);
  });
};

HTMLActuator.prototype.message = function (won) {
  var type    = won ? "game-won" : "game-over";
  var message = won ? "你赢了！" : "游戏结束！";

  this.messageContainer.classList.add(type);
  this.messageContainer.getElementsByTagName("p")[0].textContent = message;
};

HTMLActuator.prototype.clearMessage = function () {
  // IE only takes one value to remove at a time.
  this.messageContainer.classList.remove("game-won");
  this.messageContainer.classList.remove("game-over");
};
