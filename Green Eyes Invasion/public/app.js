(() => {
	const canvas = document.getElementById("gameCanvas");
	const ctx = canvas.getContext("2d");
	const headerEl = document.querySelector("header");
	const footerEl = document.querySelector("footer");

	//Aditional for the loading Level
	const $levelId = $('#level-id');

	const SCALE = 30;

	/////////////
	//Filters for the terrain build
	/////////////

	var NON_TERRAIN = "0x0001";
	var TERRAIN = "0x0002";

	//////////////
	//Format stuff
	/////////////


	const resizeCanvas = () => {
		//offset is the value with the hight and the margin
		const headerH = headerEl?.offsetHieght ?? 0;
		const footerH = footerEl?.offsetHieght ?? 0;
		canvas.width = 800;
		canvas.height = 600;
	};

	window.addEventListener("resize", resizeCanvas);
	resizeCanvas();

	const pl = planck;
	const Vec2 = pl.Vec2;

	const createWorld = () =>{
		const world = pl.World({
			gravity: Vec2(0, -10),
		})
	

		const ground = world.createBody();
		ground.createFixture(pl.Edge(Vec2(-50, 0), Vec2(50, 0)), {
			friction: 0.8,
			filterCategoryBits: TERRAIN,
			filterMaskBits: NON_TERRAIN
		});

		return {world, ground};
	}

	const {world, ground} = createWorld();

	const TIME_STEP = 1 / 60; //Check the time itself
	const VELOCITY_ITERS = 8;//Check the velocity of the objects per loops
	const POSITION_ITERS = 3;//Checks the object position per loops

	//.step(TIME_STEP, VELOCITY_ITERS, POSITION_ITERS);
	const BIRD_RADIUS = 0.5;// birds per loop
	//const BIRD_START = Vec2(5, 5);//birds initial position
	const PIG_RADIUS = 0.3;//enemy per loop

	const BIRD_STOP_SPEED = 0.15;
	const BIRD_STOP_ANGULAR = 0.25;
	const BIRD_IDLE_SECONDS = 1.0;
	const BIRD_MAX_FLIGHT_SECONDS = 10.0;

	//To adjust the dimentions of the level
	const MODIFIED_WIDTH = 1.5;
	const ORIGINAL_LEVEL_HEIGHT = 565;

	//I'm letting the two levels there as reference
	const loadLevels = [{cannon: [{x: 5, y: 0, width: 2, height: 2}], enemy: [{x: 20, y: 0, width: 2, height: 2}], blockV: [], blockH: [], Terrain: [], TNT: [],}];

	//Function called each time it needs to be loaded
	const levelloader = () => {
        const id = $levelId.val().trim();

        if (!id) {
            alert('Please enter a Level ID to load.');
            return;
        }

        const url = '/api/v1/levels/' + encodeURIComponent(id);

		const posAdjusterY = (position, reference) =>{
			return ((reference - position))/SCALE;
		}

		const posAdjusterX = (position, reference) =>{
			return reference - position;
		}

        $.ajax({
            url,
            method: 'GET',
            contentType: 'application/json',
            success: function (response) {

			//format for the level - empty array of element means 0 instance of the element
			let loadinglevel = {cannon: [], enemy: [], blockV: [], blockH: [], Terrain: [], TNT: [],};

			response.blocks.forEach(element => {	

				loadinglevel[element.type].push({x: (element.x/ SCALE) + MODIFIED_WIDTH, y: (posAdjusterY(element.y,ORIGINAL_LEVEL_HEIGHT)), width: (element.width / SCALE), height: (element.height / SCALE)});
			});

			loadLevels.push(loadinglevel);

			alert('The level is load on the list.');

            },
            error: function (xhr) {
                const msg = xhr.responseJSON?.error || xhr.responseText || 'Unknown error';
                alert('Error loading level: ' + msg);
            }
        });
	};

	//Modified with new elements
	let state = {
		levels: loadLevels,
		currentLevel: 0,
		score : 0,
		birdsRemaining: 3,
		isLevelComplete: false,
		cannon: [],
		enemy: [],
		blockV: [],
		blockH: [],
		TNT: [],
		Terrain: [],
		birds: null,
		birdLaunched: false,

		isMouseDown: false,
		mousePos: Vec2(0,0),
		launchVector: Vec2(0,0)
	};

	const setState = (patch) => {
		state = {...state, ...patch};
	};

	let birdIdleTime = 0;
	let birdFlightTime = 0;
	let levelCompleteTimer = null;
	let gameOverTimer = null;

	const resetBirdTimers = () => {
		birdIdleTime = 0;
		birdFlightTime = 0;
	};

	/////////////////////
	//creategameselevemts (Phycis)
	/////////////////////

	//Added more create functions for each element according its own physics
	const createBox = (x, y, width, height, dynamic=true) => {
		const body = world.createBody({
			position: Vec2(x,y),
			type: dynamic ? "dynamic" : "static"
		});

		body.createFixture(pl.Box(width/2, height/2), {
			density: 1.0,
			friction: 0.5,
			restitution: 0.1,
		});

		return body;
	};

	const createTNT = (x, y, width, height, dynamic=true) => {
		const body = world.createBody({
			position: Vec2(x,y),
			type: dynamic ? "dynamic" : "static"
		});

		body.createFixture(pl.Box(width/2, height/2), {
			density: 1.0,
			friction: 0.5,
			restitution: 0.1
		});

		body.isTNT = true;

		return body;
	};

	const createCannon = (x, y, width, height, dynamic=true) => {
		const body = world.createBody({
			position: Vec2(x,y),
			type: dynamic ? "dynamic" : "static",
			active: false
		});

		body.createFixture(pl.Box(width/2, height/2), {
			density: 0,
			friction: 0.5,
			restitution: 0.1
		});

		return body;
	};

	const createTerrain = (x, y, width, height, dynamic=true) => {
		const body = world.createBody({
			position: Vec2(x,y),
			type: dynamic ? "dynamic" : "static"
		});

		body.createFixture(pl.Box(width/2, height/2), {
			density: 1.0,
			friction: 0.5,
			restitution: 0.1,
			filterCategoryBits: TERRAIN,
			filterMaskBits: NON_TERRAIN
		});

		return body;
	};

	const createPig = (x, y) => {
		const body = world.createDynamicBody({
			position: Vec2(x,y)
		});

		body.createFixture(pl.Circle(PIG_RADIUS), {
			density: 1.0,
			friction: 0.5,
			restitution: 0.1,
			userData: "pig"
		});

		body.isPig = true;

		return body;
	};

	const createBird = (x, y) => {
		const body = world.createDynamicBody(Vec2(x,y));
		body.createFixture(pl.Circle(BIRD_RADIUS), {
			density: 1.5,
			friction: 0.6,
			restitution: 0.4
		});

		body.setLinearDamping(0.35);
		body.setAngularDamping(0.35);
		body.setSleepingAllowed(true);

		return body;
	};

	const destroyBirdIfExsists = () => {
		if (state.bird) {
			world.destroyBody(state.bird);
		};
	};

	const clearWorldExceptGround = () => {
		for (let body = world.getBodyList(); body;){
			const next = body.getNext();
			if(body !== ground) world.destroyBody(body);
			body = next;
		}
	}

	////////////////
	//Levels Manager
	////////////////

	const initLevel = (levelIndex) => {
		if (levelCompleteTimer) {
			levelCompleteTimer = null;
		}

		if(gameOverTimer) {
			gameOverTimer = null;
		}

		clearWorldExceptGround();

		const level = state.levels[levelIndex];

		//added list map of possible elements
		const blockV = level.blockV.map(bv => createBox(bv.x, bv.y, bv.width, bv.height, true));
		const blockH = level.blockH.map(bh => createBox(bh.x, bh.y, bh.width, bh.height, true));
		const enemy = level.enemy.map(p => createPig(p.x, p.y));
		const cannon = level.cannon.map(c => createCannon(c.x, c.y, c.width, c.height, false));
		const Terrain = level.Terrain.map(t => createTerrain(t.x, t.y, t.width, t.height, false));
		const TNT = level.TNT.map(tn => createTNT(tn.x, tn.y, tn.width, tn.height, true));
		
		const bird = createBird(state.levels[levelIndex].cannon[0].x, state.levels[levelIndex].cannon[0].y);

		//added state for posible elements
		setState({
			enemy, 
			blockV,
			blockH,
			cannon,
			TNT,
			Terrain,
			bird,
			isLevelComplete: false,
			birdLaunched: false,
			birdsRemaining: 3,
			isMouseDown: false,
			mousePos: Vec2(0,0),
			launchVector: Vec2(0,0)
		});
	};

	const resetLevel = () => initLevel(state.currentLevel);
	
	const nextLevel = () => {
		const next = state.currentLevel + 1;
		if(next < state.levels.length){
			setState({currentLevel: next})
			initLevel(next);
			return;
		}

		alert("Congratulations. Now try adding your own levels!'");
		setState({currentLevel: 0, score: 0});
		initLevel(0);
	}

	////////////////
	//Input Utils
	////////////////

	const getMouseWorldPos = (event) => {
		const rect = canvas.getBoundingClientRect();
		const mouseX = (event.clientX - rect.left) / SCALE;
		const mouseY = (canvas.height - (event.clientY - rect.top)) / SCALE;
		return Vec2(mouseX, mouseY);
	};

	const isPointOnBird = (point) => {
		const birdPos = state.bird?.getPosition();
		if (!birdPos) return false;
		return Vec2.distance(birdPos, point) < BIRD_RADIUS;
	};


	////////////////
	//Listeners
	////////////////

	//mouse main input
	canvas.addEventListener("mousedown", (e) => {
	if(state.birdsRemaining <= 0 || state.birdLaunched || !state.bird) return;

		const worldPos = getMouseWorldPos(e);
		if (isPointOnBird(worldPos)){
			setState({isMouseDown: true, mousePos: worldPos});
		}
	});

	//Is expensive, so only use if absolute necesary (like drag and drop)
	canvas.addEventListener("mousemove", (e) => {
		if (!state.isMouseDown || !state.bird) return;
		
		const worldPos = getMouseWorldPos(e);
		const launchVector = Vec2.sub(state.bird.getPosition(), worldPos);

		setState({
			mousePos: worldPos,
			launchVector 
		});
	});

	//mouse imput relelse
	canvas.addEventListener("mouseup", () => {
		if (!state.isMouseDown || !state.bird) return;

		const bird = state.bird;

		bird.setLinearVelocity(Vec2(0,0));
		bird.setAngularVelocity(0);

		const impulse = state.launchVector.mul(5);

		bird.applyLinearImpulse(impulse, bird.getWorldCenter(), true);

		resetBirdTimers();

		setState({
			isMouseDown: false,
			birdLaunched: true,
			birdsRemaining: state.birdsRemaining - 1,
		});
	});


	/////////////////
	//	Collision Logic
	/////////////////

	const isGround = (body) => body === ground;

	//Modified to also get TNT destroy collision
	world.on("post-solve", (contact, impulse) => {
		if (!impulse) return;

		const fixtureA = contact.getFixtureA();
		const fixtureB = contact.getFixtureB();
		const bodyA = fixtureA.getBody();
		const bodyB = fixtureB.getBody();

		if (!(bodyA.isPig || bodyB.isPig)) return;

		const pigBody = bodyA.isPig ? bodyA : bodyB;
		const otherBody = bodyA.isPig ? bodyB : bodyA;

		const TNTbody = bodyA.isTNT ? bodyA : bodyB;
		const otherTNT = bodyA.isTNT ? bodyB : bodyA;

		if (isGround(otherBody)) return;

		const normalImpulse = impulse.normalImpulses?.[0] ?? 0;

		if (normalImpulse > 1.0){
			pigBody.isDestroyed = true;
			TNTbody.isDestroyed = true;
		}

	});

	/////////////////
	// Update Step
	/////////////////

	const updateBirdTimers = () => {
		const bird = state.bird;
		
		if(!state.birdLaunched || !bird) return;

		birdFlightTime += TIME_STEP;

		const speed = bird.getLinearVelocity().length();
		const ang = Math.abs(bird.getAngularVelocity());

		if (speed < BIRD_STOP_SPEED && ang < BIRD_STOP_ANGULAR && !state.isMouseDown){
			birdIdleTime += TIME_STEP;
		}else {
			birdIdleTime = 0;
		}
	};

	const shouldRespawnBird = () => {
		const bird = state.bird;
		if (!state.birdLaunched || !bird) return false;

		const pos = bird.getPosition();

		const outRight = pos.x > 50;
		const outLow = pos.y < -10;
		const idleLongEnought = birdIdleTime >= BIRD_IDLE_SECONDS;
		const timeOut = birdFlightTime >= BIRD_MAX_FLIGHT_SECONDS;

		return outRight || outLow || idleLongEnought || timeOut;
	};

	const handlePigCleanup = () => {
		const remaining = state.enemy.filter(pig => {
			if (!pig.isDestroyed) return true;
			world.destroyBody(pig);
			return false;
		});
	
		const removeCount = state.enemy.length - remaining.length;
		if (removeCount > 0){
			setState({
				enemy: remaining,
				score: state.score + removeCount * 100,
			});
		};
	};

	//Added for TNT element
	const handleTNTCleanup = () => {
		const remaining = state.TNT.filter(tnt => {
			if (!tnt.isDestroyed) return true;
			world.destroyBody(tnt);
			return false;
		});
	
		const removeCount = state.TNT.length - remaining.length;
		if (removeCount > 0){
			setState({
				TNT: remaining,
				score: state.score + removeCount * 1000,
			});
		};
	};

	const checkLevelComplete = () => {
		if (state.isLevelComplete) return;
		if (state.enemy.length > 0) return;

		setState({isLevelComplete : true});

		if (!levelCompleteTimer){
			levelCompleteTimer = setTimeout(() =>{ 
				levelCompleteTimer = null;
				alert("Level Complete");
				nextLevel();
			}, 500);
		};
	};

	//Modified to match with the cannon data, which is the level start point in the level editor
	const respawnBird = () => {
		destroyBirdIfExsists();

		const bird = createBird(state.levels[state.currentLevel].cannon[0].x, state.levels[state.currentLevel].cannon[0].y);
		resetBirdTimers();
		setState({
			bird, 
			birdLaunched: false,
			isMouseDown: false,
			launchVector: Vec2(0,0)
		});
	};

	const handleBirdLifecycle = () => {
		if (!shouldRespawnBird()) return;

		if (state.birdsRemaining > 0){
			respawnBird();
			return;
		}

		if (!state.isLevelComplete && !gameOverTimer){
			console.log(state.isLevelComplete);
			gameOverTimer = setTimeout(() => {
				gameOverTimer = null;
				alert("Game Over!");
				resetLevel();
			}, 500)
		}
	}

	const update = () => {
		world.step(TIME_STEP, VELOCITY_ITERS, POSITION_ITERS);

		updateBirdTimers();
		handlePigCleanup();
		handleTNTCleanup();//Added for the TNT
		checkLevelComplete();
		handleBirdLifecycle();
	};

	//////////////
	//Rendering
	/////////////

	const toCanvasY = (yMeters) => canvas.height - yMeters * SCALE;

	const drawGround = () => {
		ctx.beginPath();
		ctx.moveTo(0,toCanvasY(0));
		ctx.lineTo(canvas.width, toCanvasY(0));
		ctx.strokeStyle = "#004d40";
		ctx.lineWidth = 2;
		ctx.stroke();
	};

	//Added more draw functions for different elements

	const drawBoxesV = () => {
		state.blockV.forEach(box => {
			const position = box.getPosition();
			const angle = box.getAngle();
			const shape = box.getFixtureList().getShape();
			const vertices = shape.m_vertices;

			ctx.save();
			ctx.translate(position.x * SCALE, toCanvasY(position.y));
			ctx.rotate(-angle);

			ctx.beginPath();
			ctx.moveTo(vertices[0].x * SCALE, -vertices[0].y * SCALE);
			for (let i = 1; i < vertices.length; i++) {
				ctx.lineTo(vertices[i].x * SCALE, -vertices[i].y * SCALE);
			}
			ctx.closePath();

			ctx.fillStyle = "#795548";
			ctx.fill();
			ctx.restore();
		});
	};

	const drawBoxesH = () => {
		state.blockH.forEach(box => {
			const position = box.getPosition();
			const angle = box.getAngle();
			const shape = box.getFixtureList().getShape();
			const vertices = shape.m_vertices;

			ctx.save();
			ctx.translate(position.x * SCALE, toCanvasY(position.y));
			ctx.rotate(-angle);

			ctx.beginPath();
			ctx.moveTo(vertices[0].x * SCALE, -vertices[0].y * SCALE);
			for (let i = 1; i < vertices.length; i++) {
				ctx.lineTo(vertices[i].x * SCALE, -vertices[i].y * SCALE);
			}
			ctx.closePath();

			ctx.fillStyle = "#795548";
			ctx.fill();
			ctx.restore();
		});
	};

	const drawTerrain = () => {
		state.Terrain.forEach(ter => {
			const position = ter.getPosition();
			const angle = ter.getAngle();
			const shape = ter.getFixtureList().getShape();
			const vertices = shape.m_vertices;

			ctx.save();
			ctx.translate(position.x * SCALE, toCanvasY(position.y));
			ctx.rotate(-angle);

			ctx.beginPath();
			ctx.moveTo(vertices[0].x * SCALE, -vertices[0].y * SCALE);
			for (let i = 1; i < vertices.length; i++) {
				ctx.lineTo(vertices[i].x * SCALE, -vertices[i].y * SCALE);
			}
			ctx.closePath();

			ctx.fillStyle = "#FF6200";
			ctx.fill();
			ctx.restore();
		});
	};

	const drawTNT = () => {
		state.TNT.forEach(tnt => {
			const position = tnt.getPosition();
			const angle = tnt.getAngle();
			const shape = tnt.getFixtureList().getShape();
			const vertices = shape.m_vertices;

			ctx.save();
			ctx.translate(position.x * SCALE, toCanvasY(position.y));
			ctx.rotate(-angle);

			ctx.beginPath();
			ctx.moveTo(vertices[0].x * SCALE, -vertices[0].y * SCALE);
			for (let i = 1; i < vertices.length; i++) {
				ctx.lineTo(vertices[i].x * SCALE, -vertices[i].y * SCALE);
			}
			ctx.closePath();

			ctx.fillStyle = "#FF0000";
			ctx.fill();
			ctx.restore();
		});
	};

	const drawCannon = () => {
		state.cannon.forEach(can => {
			const position = can.getPosition();
			const angle = can.getAngle();
			const shape = can.getFixtureList().getShape();
			const vertices = shape.m_vertices;

			ctx.save();
			ctx.translate(position.x * SCALE, toCanvasY(position.y));
			ctx.rotate(-angle);

			ctx.beginPath();
			ctx.moveTo(vertices[0].x * SCALE, -vertices[0].y * SCALE);
			for (let i = 1; i < vertices.length; i++) {
				ctx.lineTo(vertices[i].x * SCALE, -vertices[i].y * SCALE);
			}
			ctx.closePath();

			ctx.fillStyle = "rgba(0,0,0,0.7)";
			ctx.fill();
			ctx.restore();
		});
	};


	const drawPigs = () => {
		state.enemy.forEach(pig => {
			const position = pig.getPosition();

			ctx.beginPath();
			ctx.arc(position.x * SCALE, toCanvasY(position.y), PIG_RADIUS * SCALE, 0, Math.PI * 2);
			ctx.closePath();
			ctx.fillStyle = "#008515";
			ctx.fill();
			ctx.restore();
		});
	};

	const drawBird = () => {
		if (!state.bird) return;
		const pos = state.bird.getPosition();

		ctx.beginPath();
		ctx.arc(pos.x * SCALE, toCanvasY(pos.y), BIRD_RADIUS * SCALE, 0, Math.PI * 2);
		ctx.fillStyle = "#f71844"
		ctx.fill();
	};

	drawLaunchLine = () => {
		if(!state.isMouseDown || !state.bird) return;
		const birdPos = state.bird.getPosition();
		ctx.beginPath();
		ctx.moveTo(birdPos.x * SCALE, toCanvasY(birdPos.y));
		ctx.lineTo(state.mousePos.x * SCALE, toCanvasY(state.mousePos.y));

		ctx.strokeStyle = "#9e9e9e";
		ctx.lineWidth = 2;
		ctx.stroke();
	};

	const drawHUD = () => {
		ctx.fillStyle = "#000000";
		ctx.font = "16px Papyrus";
		ctx.fillText(`Score: ${state.score}`, 10, 20);
		ctx.fillText(`Level: ${state.currentLevel}`, 10, 40);
		ctx.fillText(`Birds remaining: ${state.birdsRemaining}`, 10, 60);
	};

	const draw = () => {
		ctx.clearRect(0,0,canvas.width, canvas.height);

		//Added al the draws into the complete draw function
		drawGround();
		drawBoxesV();
		drawBoxesH();
		drawTerrain();
		drawTNT();
		drawPigs();
		drawBird();
		drawLaunchLine();
		drawCannon();
		drawHUD();
	};

	const loop = () => {
		update();
		draw();
		requestAnimationFrame(loop);
	}


	//Added loading button and skip button
	$('#load-level').click(function () {
		levelloader();
		initLevel(state.currentLevel);
	});

	$('#advance').click(function () {
		nextLevel();
	});



	initLevel(state.currentLevel);
	loop();
})();