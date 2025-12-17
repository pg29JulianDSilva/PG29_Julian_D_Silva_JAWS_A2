$(function() {

    let blockCounter = 0;

	const $editor = $('#editor');
	const $levelId = $('#level-id');
    let $selector = $('#select-block').val();

	function createBlock(blockData, classBlock) {
		const id = blockData.id

        //For the change of the aspect
        let tag;

        //To reload or duplicate the element
        if(classBlock == 0){
             tag = $selector;
        }else{
             tag = classBlock;
        }

        //creates the div of the block
		const block = $('<div></div>')
			.addClass(tag)
			.attr('id',id)
			.css({
				top: blockData.y,
				left: blockData.x,
				width: blockData.width,
				height: blockData.height,
                "border-radius": blockData.br,
                "background-image": blockData.bGradient,
                "background-color": blockData.bColor,
                "transform": blockData.transform,
                "position": blockData.position,
			})
			.appendTo($editor)
		

		block.draggable({
			containment: "#editor"
		});

        blockCounter++;

        //Deletes the blocks
		block.on("contextmenu", function (e) {
			e.preventDefault();
			if (confirm("Delete this Element?")) {
				$(this).remove();
                blockCounter--;
			}
		});

        //Adititional code to create easiear ways of level design
        block.on("click", function (e) {
			e.preventDefault();
			if (confirm("Duplicate this Element?")) {
				createBlock({}, tag);
			}
		});

        //Change size of instance (Only on a specific radious)
        block.on("wheel", function (e) {
			e.preventDefault();

            let changeW = ($(this).width() + 10).toString() + "px";
            let changeH = ($(this).height() + 10).toString() + "px";

            if($(this).width() == 200 || $(this).height() == 200){
                changeW = ($(this).width() - 100).toString() + "px";
                changeH = ($(this).height() - 100).toString() + "px";
            }

            $(this).css({
			width: changeW,
			height: changeH,
			});
		});

		return block;
	}

    //Checks the total constant blocks
	function collectBlocks(tag) {
		const blocks = [];

        

        //calls the default elements of the code and enlist them in a []
        $("." + tag).each(function () {
			const b = $(this);
            let idb = b.attr('id');
            
            if(!b.attr('id')){ 
                idb = blockCounter;
            }
			const pos = b.position();
			blocks.push({
				id: idb,
				x: pos.left,
				y: pos.top,
				width: b.width(),
				height: b.height(),
                br: (($("." + tag).css("border-radius"))),
                bColor: (($("." + tag).css("background-color")).toString()),
                transform: $("." + tag).css("transform"),
                position: $("." + tag).css("position"),
                bGradient: $("." + tag).css("background-image"),
				type: tag,
			});
		});
        
		return blocks;
	};


    //For loading the block each time
	function renderLevel(blocks) {
		$editor.empty();
		blocks.forEach(b => {
			createBlock(b, b.type);
		})
	}


    //to change the element block type on each level
    $('#select-block').change((event) => {
        $selector = $('#select-block').val()
    });

    //add the block depending on the select-block
	$('#add-block').click(function () {
        createBlock({}, 0);
    });

    //adds the level to the jSON or updates it if it already exsists
    $('#save-level').click(function () {
        const blocks = []; //This is a base for a scenario where the level is (somehow) empty, although it is not possible
        
        //The information of each element on the level, added to the main base
        const blockH = collectBlocks('blockH');
        const blockV = collectBlocks('blockV');
        const TNT = collectBlocks('TNT');
        const cannons = collectBlocks('cannon');
        const enemys = collectBlocks('enemy');
        const Grounds = collectBlocks('Terrain');

        blocks.push(...blockH);
        blocks.push(...blockV);
        blocks.push(...TNT);
        blocks.push(...cannons);
        blocks.push(...enemys);
        blocks.push(...Grounds);

        //Alert in case the level is empty
        if (blocks.length === 0) {
            alert('The level is empty. Add some blocks before saving.');
            return;
        }

        const id = $levelId.val().trim();
        
        //Alert in case the level has no name
        if (id === "") {
            alert('There is no level title. Name the level before saving it.');
            return;
        }
        
        //Backend process
        const payload = { blocks };

        let method, url;
        if (id) {
            
            method = 'PUT';
            url = '/api/v1/levels/' + encodeURIComponent(id);
        } else {
            method = 'POST';
            url = '/api/v1/levels';
        }

        $.ajax({
            url,
            method,
            contentType: 'application/json',
            data: JSON.stringify(payload),
            success: function (response) {
         
                alert(response.message + ' (ID = ' + response.id + ')');

                if (!id) {
              
                    $levelId.val(response.id);
                }

            },
            error: function (xhr) {
                const msg = xhr.responseJSON?.error || xhr.responseText || 'Unknown error';
                alert('Error saving level: ' + msg);
            }
        });
    });

    //calls from jSON all data showed on the level
    $('#load-level').click(function () {
        const id = $levelId.val().trim();

        if (!id) {
            alert('Please enter a Level ID to load.');
            return;
        }

        const url = '/api/v1/levels/' + encodeURIComponent(id);

        $.ajax({
            url,
            method: 'GET',
            contentType: 'application/json',
            success: function (response) {
                renderLevel(response.blocks || []);
                alert('Level loaded successfully.');
            },
            error: function (xhr) {
                const msg = xhr.responseJSON?.error || xhr.responseText || 'Unknown error';
                alert('Error loading level: ' + msg);
            }
        });
    });

    //elminates conection with that jSON level
    $('#delete-level').click(function () {
        const id = $levelId.val().trim();

        if (!id) {
            alert('Please enter a Level ID to delete.');
            return;
        }

        if (!confirm(`Are you sure you want to delete level "${id}"?`)) {
            return;
        }

        const url = '/api/v1/levels/' + encodeURIComponent(id);

        $.ajax({
            url,
            method: 'DELETE',
            success: function () {
                alert('Level deleted.');

                $levelId.val('');
                $editor.empty();
            },
            error: function (xhr) {
                const msg = xhr.responseJSON?.error || xhr.responseText || 'Unknown error';
                alert('Error deleting level: ' + msg);
            }
        });
        blockCounter = 0;

    });

});

