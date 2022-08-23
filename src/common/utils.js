define([], function() {
	const Utils = {
		async chainWhile(cond, fns) {
			let evaluateNext = true;
			return fns.reduce(async (prev, next) => {
				const prevResult = await prev;
				evaluateNext = evaluateNext && await cond();
				if (evaluateNext) {
					return next(prevResult);
				}
			}, Promise.resolve());
		}
	};

	return Utils;
});
