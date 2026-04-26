import {
  createRootRoute, createRoute, createRouter, lazyRouteComponent,
} from "@tanstack/react-router";
import RootLayout from "./RootLayout";

const rootRoute = createRootRoute({ component: RootLayout });

const listRoute = createRoute({
  getParentRoute: () => rootRoute, path: "/",
  component: lazyRouteComponent(() => import("./routes/ListPage")),
});
const newRoute = createRoute({
  getParentRoute: () => rootRoute, path: "/new",
  component: lazyRouteComponent(() => import("./routes/FormPage")),
});
const editRoute = createRoute({
  getParentRoute: () => rootRoute, path: "/edit/$id",
  component: lazyRouteComponent(() => import("./routes/FormPage")),
});

export const router = createRouter({
  routeTree: rootRoute.addChildren([listRoute, newRoute, editRoute]),
});

declare module "@tanstack/react-router" {
  interface Register { router: typeof router }
}
